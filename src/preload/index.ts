import { contextBridge, ipcRenderer } from 'electron'
import type { PiBatch, PiBridge } from '@shared/piProtocol'

const pi: PiBridge = {
  invoke: (command) => ipcRenderer.invoke('piper:invoke', command),
  onEvent: (listener) => {
    const handler = (_event: unknown, batch: PiBatch): void => listener(batch)
    ipcRenderer.on('piper:event', handler)
    return () => {
      ipcRenderer.removeListener('piper:event', handler)
    }
  }
}

// 渲染进程只拿得到这个白名单对象；不暴露 ipcRenderer / fs / child_process。
contextBridge.exposeInMainWorld('api', { platform: process.platform, pi })
