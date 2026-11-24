import type { PiBridge } from '@shared/piProtocol'

export interface PiperApi {
  platform: string
  pi: PiBridge
}

declare global {
  interface Window {
    api: PiperApi
  }
}
