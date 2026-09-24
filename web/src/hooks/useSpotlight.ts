import { useEffect, useState } from 'react'

/**
 * Attract mode: while `active`, cycles through `ids` every `intervalMs`,
 * starting from the first. Returns null when inactive or nothing to show.
 */
export function useSpotlight(ids: string[], active: boolean, intervalMs: number): string | null {
  const [index, setIndex] = useState(0)
  const key = ids.join('|')

  useEffect(() => {
    setIndex(0)
    if (!active || ids.length === 0) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ids.length), intervalMs)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key, intervalMs])

  if (!active || ids.length === 0) return null
  return ids[index % ids.length]
}
