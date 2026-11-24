import { app, shell, BrowserWindow, session } from 'electron'
import { execFile } from 'node:child_process'
import { accessSync } from 'node:fs'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { PiGateway } from './pi/piGateway'
import { PiProcess } from './pi/piProcess'
import { isVersionSupported, resolvePiPath } from './pi/resolvePi'
import { resolveSessionsDir, SessionIndex } from './pi/sessionIndex'
import { ProjectRegistry } from './projects'
import { AppStateStore } from './appState'
import { registerPiIpc, EVENT_CHANNEL } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d0d0d',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.piper.app')

  // CSP 通过响应头下发：开发环境放行 Vite HMR 的内联脚本/ws，生产保持严格
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            is.dev
              ? "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"
              : "script-src 'self' 'wasm-unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "font-src 'self' data:",
            is.dev ? "connect-src 'self' ws: http://localhost:*" : "connect-src 'self'"
          ].join('; ')
        ]
      }
    })
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const gateway = createGateway()
  app.on('before-quit', () => {
    void gateway.handle({ type: 'stop' })
  })

  const userData = app.getPath('userData')
  registerPiIpc({
    gateway,
    sessions: new SessionIndex({ sessionsDir: resolveSessionsDir(process.env) }),
    projects: new ProjectRegistry({ filePath: join(userData, 'projects.json') }),
    appState: new AppStateStore({ filePath: join(userData, 'state.json') }),
    getWindow: () => BrowserWindow.getAllWindows()[0] ?? null
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function createGateway(): PiGateway {
  return new PiGateway({
    openProcess: (options) => PiProcess.spawn(options),
    resolvePi: async () => {
      const command = resolvePiPath({
        env: process.env,
        pathEnv: process.env.PATH ?? '',
        exists: (candidate) => {
          try {
            accessSync(candidate)
            return true
          } catch {
            return false
          }
        }
      })
      if (!command) throw new Error('未找到 pi，请先安装 @earendil-works/pi-coding-agent')
      const version = await new Promise<string>((resolve, reject) => {
        execFile(command, ['--version'], (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout.trim())
        })
      })
      return {
        command,
        version,
        warning: isVersionSupported(version) ? undefined : `pi 版本 ${version} 低于 1.6.0`
      }
    },
    emit: (batch) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(EVENT_CHANNEL, batch)
      }
    }
  })
}
