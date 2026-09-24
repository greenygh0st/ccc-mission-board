import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import type { BoardImage } from '../types'

interface Props {
  images: BoardImage[] | null
  startIndex: number
  onClose: () => void
}

// Fullscreen, swipeable photo viewer. Closes on idle (the parent unmounts it).
export default function Lightbox({ images, startIndex, onClose }: Props) {
  return (
    <AnimatePresence>
      {images && images.length > 0 && <Viewer key="lightbox" images={images} startIndex={startIndex} onClose={onClose} />}
    </AnimatePresence>
  )
}

function Viewer({ images, startIndex, onClose }: { images: BoardImage[]; startIndex: number; onClose: () => void }) {
  const [index, setIndex] = useState(Math.min(startIndex, images.length - 1))
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-space/92 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={images[index].full}
          src={images[index].full}
          alt=""
          draggable={false}
          className="max-h-[86vh] max-w-[90vw] rounded-3xl object-contain shadow-2xl"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          drag={images.length > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (info.offset.x < -80) go(1)
            else if (info.offset.x > 80) go(-1)
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </AnimatePresence>

      <button type="button" onClick={onClose} aria-label="Close" className="touch-target absolute top-[var(--gutter)] right-[var(--gutter)] grid place-items-center rounded-full glass text-cream">
        <X className="size-8" />
      </button>

      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1) }} className="touch-target absolute left-[var(--gutter)] grid place-items-center rounded-full glass text-cream">
            <ChevronLeft className="size-9" />
          </button>
          <button type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1) }} className="touch-target absolute right-[var(--gutter)] grid place-items-center rounded-full glass text-cream">
            <ChevronRight className="size-9" />
          </button>
          <div className="absolute bottom-[var(--gutter)] flex gap-2">
            {images.map((img, i) => (
              <span key={img.full} className={`h-2.5 rounded-full transition-all ${i === index ? 'w-8 bg-accent' : 'w-2.5 bg-cream/40'}`} />
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
