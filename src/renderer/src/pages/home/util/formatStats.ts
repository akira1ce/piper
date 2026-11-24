import type { SessionStats } from '@shared/piProtocol'

export function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  const scaled = value / 1000
  return `${scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1))}k`
}

export function formatCost(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatContext(usage: NonNullable<SessionStats['contextUsage']>): string {
  if (usage.tokens === null || usage.percent === null) return '—'
  return `${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)} · ${usage.percent}%`
}
