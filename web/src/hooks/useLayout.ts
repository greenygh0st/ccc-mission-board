import { useEffect, useState } from 'react'

export interface Layout {
  width: number
  height: number
  portrait: boolean
  /** landscape: left rail width; portrait: 0 */
  railW: number
  /** portrait: bottom sheet height; landscape: 0 */
  sheetH: number
  stripH: number
  /** globe centre offset from the canvas centre */
  globeOffset: [number, number]
  /** camera distance multiplier so the globe fits the available width */
  altitudeScale: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Single source of truth for the adaptive layout (also exported as CSS vars). */
export function computeLayout(width: number, height: number): Layout {
  const portrait = width / height < 1 || width < 1024
  const stripH = portrait ? clamp(height * 0.11, 96, 180) : clamp(height * 0.13, 112, 220)
  if (portrait) {
    const sheetH = Math.round(height * 0.4)
    // Visible globe area is the full width × what's above the strip + sheet;
    // scale the camera back so the globe fits that width.
    const altitudeScale = clamp((height / width) * 0.95, 1, 2.4)
    return { width, height, portrait, railW: 0, sheetH, stripH, globeOffset: [0, -(sheetH + stripH) / 2], altitudeScale }
  }
  const railW = Math.round(clamp(width * 0.3, 360, 760))
  return { width, height, portrait, railW, sheetH: 0, stripH, globeOffset: [railW / 2, -stripH / 2], altitudeScale: 1 }
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState(() => computeLayout(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const onResize = () => setLayout(computeLayout(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return layout
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}
