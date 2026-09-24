import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIdle } from '../src/hooks/useIdle'
import { computeLayout } from '../src/hooks/useLayout'
import { useSpotlight } from '../src/hooks/useSpotlight'
import { scheduleNightlyReload } from '../src/lib/kiosk'

describe('useIdle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('goes idle after the timeout, and any touch resets it', () => {
    const { result } = renderHook(() => useIdle(1000))
    expect(result.current.idle).toBe(false)
    act(() => { vi.advanceTimersByTime(1001) })
    expect(result.current.idle).toBe(true)
    act(() => { window.dispatchEvent(new Event('touchstart')) })
    expect(result.current.idle).toBe(false)
  })

  it('ignores a bumped mouse (move without buttons)', () => {
    const { result } = renderHook(() => useIdle(1000))
    act(() => { vi.advanceTimersByTime(1001) })
    act(() => { window.dispatchEvent(Object.assign(new Event('pointermove'), { pointerType: 'mouse', buttons: 0 })) })
    expect(result.current.idle).toBe(true)
  })
})

describe('useSpotlight', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cycles only while active', () => {
    const { result, rerender } = renderHook(({ active }) => useSpotlight(['a', 'b', 'c'], active, 500), { initialProps: { active: false } })
    expect(result.current).toBeNull()
    rerender({ active: true })
    expect(result.current).toBe('a')
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe('b')
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe('a')
    rerender({ active: false })
    expect(result.current).toBeNull()
  })
})

describe('computeLayout', () => {
  it('landscape kiosk: left rail and globe offset right', () => {
    const l = computeLayout(1920, 1080)
    expect(l.portrait).toBe(false)
    expect(l.railW).toBe(576)
    expect(l.globeOffset[0]).toBeGreaterThan(0)
  })

  it('4K: rail capped', () => {
    expect(computeLayout(3840, 2160).railW).toBe(760)
  })

  it('portrait: bottom sheet and globe offset up', () => {
    const l = computeLayout(1080, 1920)
    expect(l.portrait).toBe(true)
    expect(l.sheetH).toBeGreaterThan(0)
    expect(l.globeOffset[1]).toBeLessThan(0)
    // Regression: a tall screen zoomed the globe past the edges.
    expect(l.altitudeScale).toBeGreaterThan(1.5)
    expect(computeLayout(1920, 1080).altitudeScale).toBe(1)
  })
})

describe('scheduleNightlyReload', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reloads at the next 3am', () => {
    vi.setSystemTime(new Date(2026, 8, 24, 22, 0, 0))
    const reload = vi.fn()
    scheduleNightlyReload(3, reload)
    vi.advanceTimersByTime(4.9 * 3_600_000)
    expect(reload).not.toHaveBeenCalled()
    vi.advanceTimersByTime(0.2 * 3_600_000)
    expect(reload).toHaveBeenCalledOnce()
  })
})
