const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 86_400_000],
  ['month', 30 * 86_400_000],
  ['week', 7 * 86_400_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
]

/** "yesterday", "3 days ago", "2 months ago" */
export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diff = t - now
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'minute') return rtf.format(Math.round(diff / ms), unit)
  }
  return ''
}

/** "Serving since 2016" */
export function servingSinceYear(iso: string | null | undefined): string | null {
  if (!iso) return null
  const y = Number(iso.slice(0, 4))
  return Number.isFinite(y) && y > 1900 ? String(y) : null
}

export const RECENT_MS = 30 * 86_400_000
export function isRecent(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return false
  const t = Date.parse(iso)
  return !Number.isNaN(t) && now - t <= RECENT_MS
}
