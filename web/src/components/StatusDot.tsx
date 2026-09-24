import { relativeTime } from '../lib/time'

// Only visible when the board is showing cached data (Gathered unreachable or
// the token/allowlist broke). Quiet on purpose — never alarming to visitors.
export default function StatusDot({ stale, fetchedAt }: { stale: boolean; fetchedAt: string }) {
  if (!stale) return null
  return (
    <div className="flex items-center gap-2 rounded-full bg-space/60 px-3 py-1.5 text-kiosk-xs text-mist backdrop-blur" role="status">
      <span className="size-2.5 rounded-full bg-amber-400 shadow-[0_0_10px] shadow-amber-400/70" />
      Updated {relativeTime(fetchedAt)}
    </div>
  )
}
