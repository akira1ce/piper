export interface EnterKeyInput {
  key: string
  shiftKey: boolean
  isComposing: boolean
  keyCode?: number
}

/** Enter 发送只在非输入法组合态生效；Shift+Enter 永远换行。 */
export function shouldSubmitOnEnter(input: EnterKeyInput): boolean {
  if (input.isComposing || input.keyCode === 229) return false
  return input.key === 'Enter' && !input.shiftKey
}
