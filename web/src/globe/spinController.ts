// Decides when the globe slowly spins. Pure timing logic (no three.js) so it
// can be unit-tested with fake timers; MissionGlobe wires it to OrbitControls.
//
// Rules:
//  - Nothing selected → the globe slowly spins (east–west, along the equator).
//  - The user grabs it → spin stops immediately.
//  - They let go → after `resumeAfterMs` of no touching, it flies back to
//    Home, then resumes spinning.
//  - A missionary is selected (or spotlighted) → it sits still on them, and
//    letting go after a drag does NOT recenter.

export interface SpinTarget {
  setAutoRotate(on: boolean): void
  /** Fly back to the home overview over `ms` milliseconds. */
  recenter(ms: number): void
}

export interface SpinOptions {
  resumeAfterMs: number
  flyMs: number
}

export const DEFAULT_SPIN: SpinOptions = { resumeAfterMs: 10_000, flyMs: 1600 }

export class SpinController {
  private allowed = true
  private interacting = false
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly target: SpinTarget,
    private readonly opts: SpinOptions = DEFAULT_SPIN,
  ) {}

  /** Call once the globe is ready and showing Home. */
  start() {
    if (this.allowed && !this.interacting) this.target.setAutoRotate(true)
  }

  /**
   * `true` when nothing is focused. When focus clears, the caller flies to the
   * home overview itself; spinning resumes once that flight has landed.
   */
  setAllowed(allowed: boolean) {
    if (allowed === this.allowed) return
    this.allowed = allowed
    this.clear()
    if (!allowed) {
      this.target.setAutoRotate(false)
      return
    }
    this.timer = setTimeout(() => this.start(), this.opts.flyMs)
  }

  userStart() {
    this.interacting = true
    this.clear()
    this.target.setAutoRotate(false)
  }

  userEnd() {
    this.interacting = false
    this.clear()
    if (!this.allowed) return // a missionary is selected — stay where the user left it
    this.timer = setTimeout(() => {
      this.target.recenter(this.opts.flyMs)
      this.timer = setTimeout(() => this.start(), this.opts.flyMs)
    }, this.opts.resumeAfterMs)
  }

  dispose() {
    this.clear()
  }

  private clear() {
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
  }
}
