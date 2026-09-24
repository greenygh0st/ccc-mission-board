import { useCallback, useEffect, useRef, useState } from 'react'

const EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'keydown'] as const

/**
 * True after `timeoutMs` with no interaction. Any touch ends idle immediately.
 * `wake()` lets UI (e.g. "Touch to explore") end it explicitly.
 */
export function useIdle(timeoutMs: number) {
  const [idle, setIdle] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const reset = useCallback(() => {
    setIdle(false)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIdle(true), timeoutMs)
  }, [timeoutMs])

  useEffect(() => {
    reset()
    // Ignore pointermove from a mouse that isn't pressed — a bumped mouse
    // shouldn't end attract mode, but any touch should.
    const onEvent = (e: Event) => {
      if (e.type === 'pointermove' && (e as PointerEvent).pointerType === 'mouse' && (e as PointerEvent).buttons === 0) return
      reset()
    }
    for (const ev of EVENTS) window.addEventListener(ev, onEvent, { passive: true, capture: true })
    return () => {
      window.clearTimeout(timer.current)
      for (const ev of EVENTS) window.removeEventListener(ev, onEvent, { capture: true })
    }
  }, [reset])

  return { idle, wake: reset }
}
