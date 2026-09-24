import { ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { BoardMissionary } from '../types'
import Avatar from './Avatar'

interface Props {
  groups: { label: string; sensitive: boolean; missionaries: BoardMissionary[] }[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// The accessible, no-hunting way to reach everyone — including missionaries
// who aren't on the globe (sensitive, or no known location).
export default function MissionaryStrip({ groups, selectedId, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!selectedId) return
    scroller.current?.querySelector(`[data-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [selectedId])

  return (
    <div
      ref={scroller}
      className="no-scrollbar flex h-full items-stretch gap-[clamp(16px,1.6vw,40px)] overflow-x-auto overscroll-x-contain px-[var(--gutter)] [touch-action:pan-x]"
    >
      {groups.map((g) => (
        <section key={g.label} className="flex shrink-0 flex-col justify-center gap-2">
          <p className="eyebrow flex items-center gap-1.5 whitespace-nowrap">
            {g.sensitive && <ShieldCheck className="size-[1.3em]" aria-hidden />}
            {g.label}
          </p>
          <div className="flex gap-[clamp(8px,0.8vw,18px)]">
            {g.missionaries.map((m) => {
              const selected = m.id === selectedId
              return (
                <button
                  key={m.id}
                  type="button"
                  data-id={m.id}
                  onClick={() => onSelect(m.id)}
                  className={`touch-target flex items-center gap-3 rounded-full py-1.5 pr-5 pl-1.5 transition-colors ${
                    selected ? 'bg-accent text-space' : 'glass-soft text-cream active:bg-cream/15'
                  }`}
                >
                  <Avatar missionary={m} size="clamp(44px,3.2vw,72px)" />
                  <span className="max-w-[16ch] truncate text-kiosk-sm font-semibold whitespace-nowrap">{m.name}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
