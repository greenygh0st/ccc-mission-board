// Kiosk hardening: the board is a web page on a public touchscreen, so it must
// never zoom, open menus, select text, or navigate away.
export function installKioskGuards(): () => void {
  const prevent = (e: Event) => e.preventDefault()
  const noCtrlZoom = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault()
  }
  const noNavigation = (e: MouseEvent) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a')
    if (a) e.preventDefault()
  }
  const noZoomKeys = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault()
  }

  // Hide the cursor unless a real mouse is moving (touch doesn't need one).
  let cursorTimer: number | undefined
  const onMouseMove = () => {
    document.body.classList.remove('cursor-hidden')
    window.clearTimeout(cursorTimer)
    cursorTimer = window.setTimeout(() => document.body.classList.add('cursor-hidden'), 2500)
  }
  document.body.classList.add('cursor-hidden')

  document.addEventListener('contextmenu', prevent)
  document.addEventListener('gesturestart', prevent) // Safari pinch-zoom
  document.addEventListener('dragstart', prevent)
  document.addEventListener('wheel', noCtrlZoom, { passive: false })
  document.addEventListener('click', noNavigation, true)
  document.addEventListener('keydown', noZoomKeys)
  document.addEventListener('mousemove', onMouseMove)

  return () => {
    document.removeEventListener('contextmenu', prevent)
    document.removeEventListener('gesturestart', prevent)
    document.removeEventListener('dragstart', prevent)
    document.removeEventListener('wheel', noCtrlZoom)
    document.removeEventListener('click', noNavigation, true)
    document.removeEventListener('keydown', noZoomKeys)
    document.removeEventListener('mousemove', onMouseMove)
    window.clearTimeout(cursorTimer)
  }
}

/** Reload the page at the next 03:00 local time — reclaims memory on a 24/7 kiosk. */
export function scheduleNightlyReload(hour = 3, reload: () => void = () => window.location.reload()): () => void {
  const now = new Date()
  const next = new Date(now)
  next.setHours(hour, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const id = window.setTimeout(reload, next.getTime() - now.getTime())
  return () => window.clearTimeout(id)
}
