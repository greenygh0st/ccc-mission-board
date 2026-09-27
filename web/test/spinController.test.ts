import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpinController } from '../src/globe/spinController'

function setup() {
  const target = { setAutoRotate: vi.fn(), recenter: vi.fn() }
  const spin = new SpinController(target, { resumeAfterMs: 10_000, flyMs: 1600 })
  const spinning = () => target.setAutoRotate.mock.calls.at(-1)?.[0] === true
  return { target, spin, spinning }
}

describe('SpinController', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('spins slowly from the start when nothing is selected', () => {
    const { spin, spinning } = setup()
    spin.start()
    expect(spinning()).toBe(true)
  })

  it('stops while the user drags, then recenters on Home 10s after they let go and spins again', () => {
    const { spin, target, spinning } = setup()
    spin.start()
    spin.userStart()
    expect(spinning()).toBe(false)

    spin.userEnd()
    vi.advanceTimersByTime(9_999)
    expect(target.recenter).not.toHaveBeenCalled()
    expect(spinning()).toBe(false)

    vi.advanceTimersByTime(1)
    expect(target.recenter).toHaveBeenCalledWith(1600)
    expect(spinning()).toBe(false) // not while flying home

    vi.advanceTimersByTime(1600)
    expect(spinning()).toBe(true)
  })

  it('restarts the 10s wait if the user touches it again', () => {
    const { spin, target } = setup()
    spin.start()
    spin.userStart()
    spin.userEnd()
    vi.advanceTimersByTime(8_000)
    spin.userStart()
    spin.userEnd()
    vi.advanceTimersByTime(8_000)
    expect(target.recenter).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2_000)
    expect(target.recenter).toHaveBeenCalledOnce()
  })

  it('sits still on a selected missionary — no spin, and no recenter after a drag', () => {
    const { spin, target, spinning } = setup()
    spin.start()
    spin.setAllowed(false)
    expect(spinning()).toBe(false)

    spin.userStart()
    spin.userEnd()
    vi.advanceTimersByTime(60_000)
    expect(target.recenter).not.toHaveBeenCalled()
    expect(spinning()).toBe(false)
  })

  it('resumes spinning after the flight home when the selection is cleared', () => {
    const { spin, spinning } = setup()
    spin.start()
    spin.setAllowed(false)
    spin.setAllowed(true)
    expect(spinning()).toBe(false)
    vi.advanceTimersByTime(1600)
    expect(spinning()).toBe(true)
  })

  it('a selection during the 10s wait cancels the recenter', () => {
    const { spin, target } = setup()
    spin.start()
    spin.userStart()
    spin.userEnd()
    vi.advanceTimersByTime(5_000)
    spin.setAllowed(false)
    vi.advanceTimersByTime(20_000)
    expect(target.recenter).not.toHaveBeenCalled()
  })
})
