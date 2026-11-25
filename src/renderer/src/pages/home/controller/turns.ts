import type { MessageView } from '@shared/piProtocol'

export interface Turn {
  /** 该轮用户消息在 messages 数组里的下标，可直接喂给虚拟列表 */
  index: number
  /** 用于悬浮提示的单行预览 */
  preview: string
}

const PREVIEW_LIMIT = 120

/**
 * 每条用户消息开启一轮。忠实反映会话里实际出现的消息，
 * 不做去重（pi 重试/压缩时会重复写同样的用户消息）。
 */
export function buildTurns(messages: MessageView[]): Turn[] {
  const turns: Turn[] = []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    if (message.role !== 'user') continue
    turns.push({ index, preview: previewOf(message) })
  }
  return turns
}

function previewOf(message: MessageView): string {
  const text = message.blocks
    .map((block) => block.text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '（空消息）'
  return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text
}
