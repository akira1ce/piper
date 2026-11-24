export interface PiperApi {
  platform: string
}

declare global {
  interface Window {
    api: PiperApi
  }
}
