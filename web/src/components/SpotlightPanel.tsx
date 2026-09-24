import { motion } from 'framer-motion'
import { Hand } from 'lucide-react'
import { relativeTime } from '../lib/time'
import type { BoardMissionary } from '../types'
import Avatar from './Avatar'

// Attract mode: one missionary at a time, cycling, with a gentle invitation.
export default function SpotlightPanel({ missionary: m }: { missionary: BoardMissionary }) {
  const latest = m.updates[0]
  const image = latest?.images[0] ?? m.photo
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <motion.div
        key={m.id}
        initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-[clamp(14px,1.3vw,28px)]"
      >
        <p className="eyebrow">Missionary spotlight</p>
        {image && <img src={image.full} alt="" className="aspect-[4/3] max-h-[36vh] w-full rounded-3xl object-cover" draggable={false} />}
        <div className="flex items-center gap-4">
          <Avatar missionary={m} size="clamp(56px,4vw,92px)" ring />
          <div className="min-w-0">
            <h2 className="font-display text-kiosk-xl leading-tight font-semibold">{m.name}</h2>
            <p className="text-kiosk-sm text-mist">{m.sensitive ? m.region : [m.country, m.ministryFocus].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        {latest && (
          <div>
            {latest.title && <h3 className="font-display text-kiosk-lg font-semibold">{latest.title}</h3>}
            <p className="mt-1 line-clamp-4 text-kiosk-base leading-relaxed whitespace-pre-line text-cream/85">{latest.body}</p>
            <p className="mt-2 text-kiosk-xs text-mist">{relativeTime(latest.publishedAt)}</p>
          </div>
        )}
      </motion.div>
      <div className="flex animate-breathe items-center gap-3 self-start rounded-full bg-accent/90 px-6 py-3 text-kiosk-base font-semibold text-space shadow-[0_10px_40px_-10px] shadow-accent">
        <Hand className="size-[1.2em]" aria-hidden /> Touch to explore
      </div>
    </div>
  )
}
