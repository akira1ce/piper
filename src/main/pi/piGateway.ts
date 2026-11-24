import type { ModelInfo, PiBatch, PiCommand, PiResult } from '@shared/piProtocol'
import { EventBatcher } from './eventBatcher'
import { mapRecord } from './mapRecord'
import { PiClient, type PiTransport } from './piClient'

export interface ResolvedPi {
  command: string
  version: string
  warning?: string
}

export interface PiGatewayDeps {
  openProcess: (options: { command: string; args: string[]; cwd: string }) => PiTransport
  resolvePi: () => Promise<ResolvedPi>
  emit: (batch: PiBatch) => void
  intervalMs?: number
}

export class PiGateway {
  private client: PiClient | null = null
  private transport: PiTransport | null = null
  private batcher: EventBatcher
  private models: ModelInfo[] = []

  constructor(private deps: PiGatewayDeps) {
    this.batcher = new EventBatcher(deps.intervalMs ?? 30, deps.emit)
  }

  async handle(command: PiCommand): Promise<PiResult> {
    try {
      return { ok: true, data: await this.route(command) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async route(command: PiCommand): Promise<unknown> {
    switch (command.type) {
      case 'start':
        return this.start(command.cwd, command.sessionPath)
      case 'stop':
        return this.stop()
      case 'models':
        this.requireClient()
        return { models: this.models }
      case 'state':
        return this.requireClient().request({ type: 'get_state' })
      case 'prompt':
        return this.requireClient().request({
          type: 'prompt',
          message: command.text,
          ...(command.behavior ? { streamingBehavior: command.behavior } : {})
        })
      case 'abort':
        return this.requireClient().request({ type: 'abort' })
      case 'clearQueue':
        return this.requireClient().request({ type: 'clear_queue' })
      case 'messages':
        return this.requireClient().request({ type: 'get_messages' })
      case 'stats':
        return this.requireClient().request({ type: 'get_session_stats' })
      case 'thinkingLevels':
        return this.requireClient().request({ type: 'get_available_thinking_levels' })
      case 'setThinkingLevel':
        return this.requireClient().request({ type: 'set_thinking_level', level: command.level })
      case 'setModel':
        return this.requireClient().request({
          type: 'set_model',
          provider: command.provider,
          modelId: command.modelId
        })
      case 'newSession':
        return this.requireClient().request({ type: 'new_session' })
      case 'switchSession':
        return this.requireClient().request({
          type: 'switch_session',
          sessionPath: command.sessionPath
        })
      case 'renameSession':
        return this.requireClient().request({ type: 'set_session_name', name: command.name })
      case 'extensionRespond':
        return this.requireClient().respond({
          type: 'extension_ui_response',
          id: command.id,
          ...(command.value !== undefined ? { value: command.value } : {}),
          ...(command.confirmed !== undefined ? { confirmed: command.confirmed } : {}),
          ...(command.cancelled ? { cancelled: true } : {})
        })
      case 'sessions':
      case 'projects':
      case 'addProject':
      case 'removeProject':
      case 'renameProject':
      case 'pickDirectory':
        throw new Error(`command ${command.type} is handled by ipc.ts`)
      default:
        throw new Error('unsupported command')
    }
  }

  private async start(cwd: string, sessionPath?: string): Promise<ResolvedPi & { state: unknown }> {
    await this.stop()
    const resolved = await this.deps.resolvePi()
    const transport = this.deps.openProcess({
      command: resolved.command,
      args: ['--mode', 'rpc', ...(sessionPath ? ['--session', sessionPath] : [])],
      cwd
    })
    const client = new PiClient(transport)
    client.onRecord((record) => {
      for (const event of mapRecord(record)) this.batcher.push(event)
    })
    client.onProtocolError((message) => this.batcher.push({ type: 'protocol_error', message }))
    transport.onExit((info) => {
      // 主动 stop/切换会话时，旧进程的 exit 不应上报为异常
      if (this.transport !== transport) return
      this.client = null
      this.transport = null
      this.batcher.push({
        type: 'process_exit',
        code: info.code,
        signal: info.signal,
        stderrTail: transport.stderrTail?.() ?? ''
      })
      this.batcher.flush()
    })

    this.client = client
    this.transport = transport
    const state = await client.request({ type: 'get_state' })
    this.models = []
    try {
      const models = (await client.request({ type: 'get_available_models' })) as {
        models: ModelInfo[]
      }
      this.models = models.models
    } catch {
      // 未配置模型时不影响会话本身
    }
    return { ...resolved, state }
  }

  private async stop(): Promise<void> {
    const client = this.client
    const transport = this.transport
    this.client = null
    this.transport = null
    if (client) {
      try {
        await client.request({ type: 'abort' }, 3000)
      } catch {
        // 进程可能已经退出
      }
      client.dispose()
    }
    await transport?.stop?.()
  }

  private requireClient(): PiClient {
    if (!this.client) throw new Error('pi is not running')
    return this.client
  }
}
