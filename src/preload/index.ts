import { contextBridge } from 'electron'

// 渲染进程只拿得到这个白名单对象；不暴露 ipcRenderer / fs / child_process。
const api = {
  platform: process.platform
}

contextBridge.exposeInMainWorld('api', api)
