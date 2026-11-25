export interface MentionContext {
  /** 光标前 `@` 的位置 */
  start: number
  /** `@` 之后到光标的查询串 */
  query: string
}

const WORD_BREAK = /[\s([{"'`,;]/

/**
 * 判断光标前是否处于一个 `@file` 补全 token 内。
 * `@` 必须位于行首或空白/标点之后，且到光标之间不含空白。
 */
export function getMentionContext(text: string, caret: number): MentionContext | null {
  if (caret < 0 || caret > text.length) return null
  const before = text.slice(0, caret)
  for (let index = before.length - 1; index >= 0; index--) {
    const char = before[index]
    if (char === '@') {
      if (index === 0) return { start: index, query: before.slice(index + 1) }
      return WORD_BREAK.test(before[index - 1])
        ? { start: index, query: before.slice(index + 1) }
        : null
    }
    if (WORD_BREAK.test(char)) return null
  }
  return null
}

const SEGMENT_BONUS = 8
const RUN_BONUS = 12
const BASENAME_BONUS = 24
const SCATTER_PENALTY = 1

/**
 * fzf 风格子序列打分：命中越高越好，路径越短越好。
 * 无匹配返回 null。
 */
export function scoreFile(path: string, query: string): number | null {
  const needle = query.toLowerCase()
  if (!needle) return 0

  const haystack = path.toLowerCase()
  const basenameStart = haystack.lastIndexOf('/') + 1
  let score = 0
  let cursor = 0
  let previousIndex = -1

  for (const char of needle) {
    const found = haystack.indexOf(char, cursor)
    if (found === -1) return null

    const isRun = found === previousIndex + 1
    const isSegmentStart = found === 0 || haystack[found - 1] === '/' || haystack[found - 1] === '-'
    if (isRun) score += RUN_BONUS
    else if (isSegmentStart) score += SEGMENT_BONUS
    else score -= SCATTER_PENALTY
    if (found >= basenameStart) score += 1

    previousIndex = found
    cursor = found + 1
  }

  const matchedInBasename = previousIndex >= basenameStart
  if (matchedInBasename && haystack.slice(basenameStart).includes(needle)) score += BASENAME_BONUS
  score -= Math.floor(path.length / 8)
  return score
}

export function rankFiles(files: string[], query: string, limit = 50): string[] {
  const scored: { path: string; score: number }[] = []
  for (const path of files) {
    const score = scoreFile(path, query)
    if (score !== null) scored.push({ path, score })
  }
  scored.sort((a, b) => b.score - a.score || a.path.length - b.path.length)
  return scored.slice(0, limit).map((item) => item.path)
}
