import type { MessageView, TurnChanges } from '@shared/piProtocol'
import { mergeChanges, summarizeChanges } from './changes'

export function aggregateTurnChanges(messages: MessageView[]): MessageView[] {
  const result = messages.map((message) => ({
    ...message,
    blocks: message.blocks.map((block) => ({ ...block })),
    ...(message.changes
      ? {
          changes: {
            ...message.changes,
            files: message.changes.files.map((file) => ({ ...file }))
          }
        }
      : {})
  }))

  let turnStart = -1
  for (let index = 0; index <= result.length; index += 1) {
    const message = result[index]
    if (message?.role === 'user' || index === result.length) {
      if (turnStart >= 0) aggregateTurn(result, turnStart, index)
      turnStart = message?.role === 'user' ? index : -1
    }
  }

  return result
}

function aggregateTurn(messages: MessageView[], start: number, end: number): void {
  const assistantIndexes: number[] = []
  let changes: TurnChanges | null = null

  for (let index = start + 1; index < end; index += 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue
    assistantIndexes.push(index)
    if (message.changes) {
      changes = summarizeChanges(
        message.changes.files.reduce(
          (files, file) => mergeChanges(files, file),
          changes?.files ?? []
        )
      )
    }
    delete message.changes
  }

  const lastAssistantIndex = assistantIndexes.at(-1)
  if (changes && lastAssistantIndex !== undefined) {
    messages[lastAssistantIndex].changes = changes
  }
}
