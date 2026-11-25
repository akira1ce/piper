const MIRRORED_PROPERTIES = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontFamily',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textAlign',
  'textTransform',
  'textIndent',
  'whiteSpace',
  'wordBreak',
  'tabSize'
] as const

export interface CaretCoordinates {
  top: number
  left: number
  height: number
}

/**
 * textarea 没有原生光标坐标 API，用隐藏 mirror 复制文本与排版后测量。
 * 返回值相对于 textarea 的 padding box。
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): CaretCoordinates {
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)
  for (const property of MIRRORED_PROPERTIES) {
    mirror.style[property] = style[property]
  }
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.top = '0'
  mirror.style.left = '0'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflow = 'hidden'

  mirror.textContent = textarea.value.slice(0, position)
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(position) || '.'
  mirror.appendChild(marker)

  document.body.appendChild(mirror)
  const coordinates = {
    top: marker.offsetTop,
    left: marker.offsetLeft,
    height: marker.offsetHeight
  }
  document.body.removeChild(mirror)
  return coordinates
}
