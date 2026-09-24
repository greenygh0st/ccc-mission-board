import { Component, type ReactNode } from 'react'

// A 24/7 kiosk must heal itself: on a render crash, show a calm screen and
// remount the app after 10 seconds.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; generation: number }> {
  state = { failed: false, generation: 0 }
  private timer: number | undefined

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Board crashed; recovering in 10s', error)
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => this.setState((s) => ({ failed: false, generation: s.generation + 1 })), 10_000)
  }

  componentWillUnmount() {
    window.clearTimeout(this.timer)
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="starfield relative grid h-full place-items-center">
          <p className="relative font-display text-kiosk-xl text-cream/80">One moment…</p>
        </div>
      )
    }
    return <div key={this.state.generation} className="contents">{this.props.children}</div>
  }
}
