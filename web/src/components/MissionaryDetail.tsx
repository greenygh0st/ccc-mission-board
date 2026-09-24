import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, ShieldCheck } from 'lucide-react'
import { servingSinceYear } from '../lib/time'
import type { BoardMissionary, BoardUpdate } from '../types'
import QrCode from './QrCode'
import UpdateCard from './UpdateCard'

interface Props {
  missionary: BoardMissionary
  onBack: () => void
  onOpenImage: (images: BoardUpdate['images'], index: number) => void
}

export default function MissionaryDetail({ missionary: m, onBack, onOpenImage }: Props) {
  const updates = m.updates.slice(0, 3)
  const since = servingSinceYear(m.servingSince)
  const meta = [m.organization, m.ministryFocus].filter(Boolean).join(' · ')
  const place = m.sensitive ? m.region : [m.country, m.region].filter(Boolean).join(' · ')

  return (
    <motion.div
      key={m.id}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ type: 'spring', stiffness: 240, damping: 30 }}
      className="no-scrollbar flex h-full flex-col gap-[clamp(14px,1.3vw,28px)] overflow-y-auto pb-4 *:shrink-0"
    >
      <button
        type="button"
        onClick={onBack}
        className="touch-target flex w-fit items-center gap-2 rounded-full glass-soft px-5 text-kiosk-sm font-semibold text-cream active:bg-cream/15"
      >
        <ArrowLeft className="size-[1.2em]" aria-hidden /> All updates
      </button>

      <div className="relative overflow-hidden rounded-3xl">
        {m.photo ? (
          <button type="button" className="block w-full" onClick={() => onOpenImage([m.photo!], 0)} aria-label="Open photo">
            <img src={m.photo.full} alt="" className="aspect-[4/3] max-h-[36vh] w-full object-cover" draggable={false} />
          </button>
        ) : (
          <div className="grid aspect-[16/7] place-items-center bg-gradient-to-br from-primary via-deep to-space">
            {m.sensitive && <ShieldCheck className="size-16 text-mist/70" aria-hidden />}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-space via-space/70 to-transparent p-[clamp(16px,1.5vw,32px)] pt-24">
          <h2 className="font-display text-kiosk-2xl leading-[1.05] font-semibold text-cream">{m.name}</h2>
          {m.memberNames && <p className="mt-1 text-kiosk-base text-cream/85">{m.memberNames}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {place && (
          <p className="flex items-center gap-2 text-kiosk-base text-cream">
            <MapPin className="size-[1.1em] shrink-0 text-accent" aria-hidden /> {place}
          </p>
        )}
        {meta && <p className="text-kiosk-sm text-mist">{meta}</p>}
        {since && <p className="text-kiosk-sm text-mist">Serving since {since}</p>}
        {m.sensitive && (
          <p className="mt-1 flex items-start gap-2 rounded-2xl glass-soft p-3 text-kiosk-sm text-cream/80">
            <ShieldCheck className="mt-0.5 size-[1.2em] shrink-0 text-mist" aria-hidden />
            To protect this family, their name and location are kept private. Please pray for them.
          </p>
        )}
      </div>

      {m.bio && <p className="text-kiosk-base leading-relaxed whitespace-pre-line text-cream/85">{m.bio}</p>}

      {updates.length > 0 && (
        <section className="flex flex-col gap-[clamp(12px,1.1vw,24px)]">
          <p className="eyebrow">Latest updates</p>
          {updates.map((u) => (
            <UpdateCard key={u.id} update={u} missionary={m} showMissionary={false} clampLines={0} onOpenImage={(i) => onOpenImage(u.images, i)} />
          ))}
        </section>
      )}

      {m.websiteUrl && !m.sensitive && <QrCode url={m.websiteUrl} label="Scan to follow their ministry on your phone" />}
    </motion.div>
  )
}
