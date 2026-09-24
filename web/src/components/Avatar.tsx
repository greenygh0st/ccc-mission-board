import { ShieldCheck } from 'lucide-react'
import type { BoardMissionary } from '../types'

const initials = (name: string) =>
  name
    .replace(/^the\s+/i, '')
    .replace(/\s+family$/i, '')
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

export default function Avatar({ missionary, size, ring = false }: { missionary: BoardMissionary; size: string; ring?: boolean }) {
  const style = { width: size, height: size }
  const ringClass = ring ? 'ring-[3px] ring-accent ring-offset-2 ring-offset-space' : 'ring-1 ring-cream/15'
  if (missionary.photo) {
    return <img src={missionary.photo.thumb} alt="" style={style} className={`shrink-0 rounded-full object-cover ${ringClass}`} draggable={false} />
  }
  return (
    <div
      style={style}
      className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-deep font-display font-semibold text-cream/90 ${ringClass}`}
    >
      {missionary.sensitive ? <ShieldCheck className="size-[45%] text-mist" aria-hidden /> : <span style={{ fontSize: `calc(${size} * 0.36)` }}>{initials(missionary.name)}</span>}
    </div>
  )
}
