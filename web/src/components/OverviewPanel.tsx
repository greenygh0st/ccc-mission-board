import { AnimatePresence } from 'framer-motion'
import type { BoardMissionary, BoardUpdate } from '../types'
import UpdateCard from './UpdateCard'

interface Props {
  updates: BoardUpdate[]
  byId: Map<string, BoardMissionary>
  stats: { missionaries: number; countries: number }
  onSelect: (missionaryId: string) => void
  onOpenImage: (update: BoardUpdate, index: number) => void
}

export default function OverviewPanel({ updates, byId, stats, onSelect, onOpenImage }: Props) {
  return (
    <div className="flex h-full flex-col gap-[clamp(14px,1.4vw,32px)]">
      <header>
        <p className="eyebrow">Latest from the field</p>
        <h2 className="mt-2 font-display text-kiosk-2xl leading-[1.05] font-semibold text-cream">
          Our missionaries
          <span className="block text-accent italic">around the world</span>
        </h2>
        <p className="mt-3 text-kiosk-sm text-mist">
          {stats.missionaries} {stats.missionaries === 1 ? 'missionary' : 'missionaries'}
          {stats.countries > 0 && <> · {stats.countries} {stats.countries === 1 ? 'country' : 'countries'}</>}
        </p>
      </header>

      <div className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-[clamp(12px,1.1vw,24px)] overflow-y-auto px-1 pb-2 *:shrink-0">
        <AnimatePresence initial={false} mode="popLayout">
          {updates.map((u) => (
            <UpdateCard
              key={u.id}
              update={u}
              missionary={byId.get(u.missionaryId)}
              onTap={() => onSelect(u.missionaryId)}
              onOpenImage={(i) => onOpenImage(u, i)}
            />
          ))}
        </AnimatePresence>
        {updates.length === 0 && (
          <p className="rounded-3xl glass-soft p-6 text-kiosk-base text-cream/80">
            Tap a light on the globe to meet the missionaries we support.
          </p>
        )}
      </div>
    </div>
  )
}
