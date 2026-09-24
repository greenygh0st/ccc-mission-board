import { motion } from 'framer-motion'
import { Images } from 'lucide-react'
import { relativeTime } from '../lib/time'
import type { BoardMissionary, BoardUpdate } from '../types'
import Avatar from './Avatar'

interface Props {
  update: BoardUpdate
  missionary: BoardMissionary | undefined
  /** Show who it's from (overview) vs. not (inside a missionary's own panel) */
  showMissionary?: boolean
  highlighted?: boolean
  clampLines?: number
  onTap?: () => void
  onOpenImage?: (index: number) => void
}

// Update bodies are user-submitted: always rendered as plain text (React
// escapes), line breaks preserved — never as HTML.
export default function UpdateCard({ update, missionary, showMissionary = true, highlighted, clampLines = 3, onTap, onOpenImage }: Props) {
  const firstImage = update.images[0]
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      onClick={onTap}
      role={onTap ? 'button' : undefined}
      tabIndex={onTap ? 0 : undefined}
      className={`group relative shrink-0 overflow-hidden rounded-3xl glass-soft transition-colors ${onTap ? 'active:bg-cream/10' : ''} ${
        highlighted ? 'ring-2 ring-accent/70' : ''
      }`}
    >
      {firstImage && (
        <button
          type="button"
          className="relative block aspect-[16/8] max-h-[24vh] w-full overflow-hidden"
          onClick={(e) => {
            if (!onOpenImage) return
            e.stopPropagation()
            onOpenImage(0)
          }}
          aria-label="Open photo"
        >
          <img src={firstImage.thumb} alt="" className="h-full w-full object-cover" draggable={false} />
          <div className="absolute inset-0 bg-gradient-to-t from-space/80 via-transparent to-transparent" />
          {update.images.length > 1 && (
            <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-space/70 px-3 py-1.5 text-kiosk-xs font-medium backdrop-blur">
              <Images className="size-[1.1em]" aria-hidden /> {update.images.length}
            </span>
          )}
        </button>
      )}
      <div className="flex flex-col gap-[0.6em] p-[clamp(14px,1.3vw,28px)]">
        <div className="flex items-center gap-3">
          {showMissionary && missionary && <Avatar missionary={missionary} size="clamp(40px,2.8vw,64px)" />}
          <div className="min-w-0">
            {showMissionary && missionary && (
              <p className="truncate font-display text-kiosk-base font-semibold text-cream">{missionary.name}</p>
            )}
            <p className="text-kiosk-xs text-mist">{relativeTime(update.publishedAt)}</p>
          </div>
        </div>
        {update.title && <h3 className="font-display text-kiosk-lg leading-tight font-semibold text-cream">{update.title}</h3>}
        <p
          className="text-kiosk-sm leading-relaxed whitespace-pre-line text-cream/85"
          style={clampLines ? { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}
        >
          {update.body}
        </p>
      </div>
    </motion.article>
  )
}
