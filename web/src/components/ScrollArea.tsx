import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// Leave this much slack before calling it "the bottom" (sub-pixel rounding,
// the last card's shadow).
const END_SLACK_PX = 24

/**
 * A vertical scroll container that tells kiosk visitors there's more below:
 * a bottom fade plus a tappable "Scroll for more" pill, shown only while
 * content overflows and the reader isn't at the end. Touch screens hide
 * scrollbars, so without this people don't know a panel scrolls.
 *
 * `className` styles the scrolling element itself (flex column, gaps, …) so
 * callers keep their existing layout.
 */
export default function ScrollArea({ className = '', children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  const check = useCallback(() => {
    const el = ref.current
    if (!el) return
    setMore(el.scrollHeight - el.scrollTop - el.clientHeight > END_SLACK_PX)
  }, [])

  // Content height changes after mount (photos load, panels swap), so watch
  // the container and each child, re-observing when children change.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    check()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(check)
    const observeAll = () => {
      ro.disconnect()
      ro.observe(el)
      for (const child of Array.from(el.children)) ro.observe(child)
      check()
    }
    observeAll()
    const mo = new MutationObserver(observeAll)
    mo.observe(el, { childList: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [check])

  const scrollDown = () => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ top: Math.round(el.clientHeight * 0.8), behavior: 'smooth' })
  }

  return (
    <div className="relative h-full min-h-0">
      <div ref={ref} onScroll={check} className={`h-full overflow-y-auto overscroll-contain ${className}`} data-testid="scroll-area">
        {children}
      </div>

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgb(5_16_22)] to-transparent transition-opacity duration-300 ${
          more ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <button
        type="button"
        onClick={scrollDown}
        tabIndex={more ? 0 : -1}
        aria-hidden={!more}
        className={`touch-target absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-space/80 px-5 text-kiosk-sm font-semibold text-cream shadow-lg ring-1 ring-cream/15 backdrop-blur transition-opacity duration-300 ${
          more ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        Scroll for more
        <ChevronDown className="size-[1.2em] animate-bounce text-accent" aria-hidden />
      </button>
    </div>
  )
}
