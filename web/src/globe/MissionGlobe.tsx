import { useEffect, useMemo, useRef } from 'react'
import Globe, { type GlobeMethods } from 'react-globe.gl'
import { Color, MeshPhongMaterial } from 'three'
import { angularDistance, HEX_RESOLUTION, hexLandFeatures, type PlacedMissionary } from './geo'

export interface MissionGlobeProps {
  width: number
  height: number
  /** px offset of the globe's centre from the canvas centre (to sit beside the rail) */
  offset: [number, number]
  placed: PlacedMissionary[]
  home: { lat: number; lng: number; name: string }
  accent: string
  /** Missionary to fly to (selection or attract-mode spotlight) */
  focusId: string | null
  /** Missionaries with a recent update get a pulsing ring */
  recentIds: Set<string>
  autoRotate: boolean
  reducedMotion: boolean
  /** Camera distance multiplier. The camera's field of view is vertical, so on a
   *  tall (portrait) screen the globe would overflow the width without this. */
  altitudeScale?: number
  onSelect: (id: string) => void
}

const OVERVIEW = { lat: 18, lng: -40, altitude: 2.35 }
const FOCUS_ALTITUDE = 1.55
const TAP_RADIUS_PX = 56

type HtmlDatum = { lat: number; lng: number; kind: 'home' | 'label'; text: string }

export default function MissionGlobe(props: MissionGlobeProps) {
  const { width, height, offset, placed, home, accent, focusId, recentIds, autoRotate, reducedMotion, onSelect, altitudeScale = 1 } = props
  const globeRef = useRef<GlobeMethods | undefined>(undefined)
  const readyRef = useRef(false)

  const material = useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color('#0a2733'),
        emissive: new Color('#03111a'),
        emissiveIntensity: 0.9,
        specular: new Color('#2b6a80'),
        shininess: 22,
      }),
    [],
  )

  const focused = placed.find((p) => p.missionary.id === focusId) ?? null

  // ── Layer data (memoised so three-globe doesn't rebuild every render) ──────
  const arcs = useMemo(
    () => placed.map((p, i) => ({ startLat: home.lat, startLng: home.lng, endLat: p.lat, endLng: p.lng, id: p.missionary.id, i })),
    [placed, home.lat, home.lng],
  )
  const rings = useMemo(
    () => placed.filter((p) => recentIds.has(p.missionary.id) || p.missionary.id === focusId),
    [placed, recentIds, focusId],
  )
  const html = useMemo<HtmlDatum[]>(() => {
    const items: HtmlDatum[] = [{ lat: home.lat, lng: home.lng, kind: 'home', text: home.name }]
    if (focused) items.push({ lat: focused.lat, lng: focused.lng, kind: 'label', text: focused.missionary.name })
    return items
  }, [home.lat, home.lng, home.name, focused])

  // ── Camera / controls ──────────────────────────────────────────────────────
  // Runs on mount. (globe.gl's onGlobeReady only fires once a globe *texture*
  // loads — we use a plain material, so it never would.)
  const setup = () => {
    const g = globeRef.current
    if (!g || readyRef.current) return
    readyRef.current = true
    if (import.meta.env.DEV) (window as unknown as { __globe: GlobeMethods }).__globe = g // debugging aid
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)) // 4K-safe on iGPUs
    const c = g.controls()
    c.enablePan = false
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.rotateSpeed = 0.55
    c.zoomSpeed = 0.7
    c.minDistance = 100 * (1 + 0.75 * altitudeScale)
    c.maxDistance = 100 * (1 + 3.6 * altitudeScale)
    g.pointOfView({ ...OVERVIEW, altitude: OVERVIEW.altitude * altitudeScale }, 0)
  }

  // Zoom limits follow the aspect-ratio scale (radius 100 → distance = 100 × (1 + altitude)).
  useEffect(() => {
    const c = globeRef.current?.controls()
    if (!c) return
    c.minDistance = 100 * (1 + 0.75 * altitudeScale)
    c.maxDistance = 100 * (1 + 3.6 * altitudeScale)
  }, [altitudeScale])

  useEffect(() => {
    setup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const c = globeRef.current?.controls()
    if (!c) return
    c.autoRotate = autoRotate
    c.autoRotateSpeed = reducedMotion ? 0.15 : 0.45
  }, [autoRotate, reducedMotion])

  useEffect(() => {
    const g = globeRef.current
    if (!g || !readyRef.current) return
    if (focused) g.pointOfView({ lat: focused.lat, lng: focused.lng, altitude: FOCUS_ALTITUDE * altitudeScale }, reducedMotion ? 0 : 1400)
    else g.pointOfView({ ...OVERVIEW, altitude: OVERVIEW.altitude * altitudeScale }, reducedMotion ? 0 : 1600)
    // Fly on focus change (or rotation to portrait) only; re-flying on unrelated
    // re-renders would fight the user's drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, altitudeScale])

  // Don't burn the GPU while the kiosk screen is hidden/asleep.
  useEffect(() => {
    const onVis = () => {
      const g = globeRef.current
      if (!g) return
      if (document.hidden) g.pauseAnimation()
      else g.resumeAnimation()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Fat-finger taps: pick the nearest dot within TAP_RADIUS_PX of the touch.
  const handleGlobeTap = (coords: { lat: number; lng: number }, event: MouseEvent) => {
    const g = globeRef.current
    if (!g) return
    const target = event.target as HTMLElement | null
    const rect = target?.getBoundingClientRect()
    const x = event.clientX - (rect?.left ?? 0)
    const y = event.clientY - (rect?.top ?? 0)
    let best: { id: string; d: number } | null = null
    for (const p of placed) {
      if (angularDistance(coords.lat, coords.lng, p.lat, p.lng) > 70) continue // far side of the globe
      const s = g.getScreenCoords(p.lat, p.lng, 0.02)
      const d = Math.hypot(s.x - x, s.y - y)
      if (d <= TAP_RADIUS_PX && (!best || d < best.d)) best = { id: p.missionary.id, d }
    }
    if (best) onSelect(best.id)
  }

  const accentRgb = hexToRgb(accent)

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeOffset={offset}
      backgroundColor="rgba(0,0,0,0)"
      rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onGlobeReady={setup}
      animateIn={!reducedMotion}
      // Globe + atmosphere
      globeMaterial={material}
      showAtmosphere
      atmosphereColor="#7cc4db"
      atmosphereAltitude={0.2}
      // Land: hex dots from the bundled Natural Earth map
      hexPolygonsData={hexLandFeatures}
      hexPolygonResolution={HEX_RESOLUTION}
      hexPolygonMargin={0.62}
      hexPolygonUseDots
      hexPolygonAltitude={0.004}
      hexPolygonColor={() => 'rgba(190, 226, 236, 0.62)'}
      hexPolygonsTransitionDuration={0}
      // Missionaries
      pointsData={placed}
      pointLat="lat"
      pointLng="lng"
      pointAltitude={(d: object) => ((d as PlacedMissionary).missionary.id === focusId ? 0.07 : 0.025)}
      pointRadius={(d: object) => ((d as PlacedMissionary).missionary.id === focusId ? 0.75 : 0.5)}
      pointColor={(d: object) => ((d as PlacedMissionary).missionary.id === focusId ? '#fff4df' : accent)}
      pointResolution={16}
      pointsMerge={false}
      pointsTransitionDuration={reducedMotion ? 0 : 600}
      onPointClick={(d: object) => onSelect((d as PlacedMissionary).missionary.id)}
      onGlobeClick={handleGlobeTap}
      // Pulses on recent/selected
      ringsData={rings}
      ringLat="lat"
      ringLng="lng"
      ringAltitude={0.012}
      ringColor={() => (t: number) => `rgba(${accentRgb}, ${Math.max(0, 1 - t) * 0.85})`}
      ringMaxRadius={4.5}
      ringPropagationSpeed={reducedMotion ? 0 : 2.2}
      ringRepeatPeriod={1600}
      // Arcs from home to every missionary
      arcsData={arcs}
      arcColor={(d: object) =>
        (d as { id: string }).id === focusId
          ? [`rgba(${accentRgb}, 0.35)`, 'rgba(255, 244, 223, 0.95)']
          : [`rgba(${accentRgb}, 0.05)`, `rgba(${accentRgb}, 0.75)`]
      }
      arcStroke={(d: object) => ((d as { id: string }).id === focusId ? 0.5 : 0.32)}
      arcAltitudeAutoScale={0.42}
      arcDashLength={0.45}
      arcDashGap={0.25}
      arcDashInitialGap={(d: object) => ((d as { i: number }).i * 0.37) % 1}
      arcDashAnimateTime={reducedMotion ? 0 : 5200}
      arcsTransitionDuration={0}
      // Home marker + focused name label (DOM, no pointer events)
      htmlElementsData={html}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={(d: object) => ((d as HtmlDatum).kind === 'label' ? 0.08 : 0.01)}
      htmlElement={(d: object) => htmlMarker(d as HtmlDatum)}
      htmlTransitionDuration={0}
    />
  )
}

function htmlMarker(d: HtmlDatum): HTMLElement {
  const el = document.createElement('div')
  el.style.pointerEvents = 'none'
  if (d.kind === 'home') {
    el.className = 'globe-home'
    el.innerHTML = '<span class="globe-home-dot"></span><span class="globe-home-label"></span>'
    el.querySelector('.globe-home-label')!.textContent = d.text // never innerHTML data
  } else {
    el.className = 'globe-label'
    el.textContent = d.text
  }
  return el
}

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return '189, 113, 66'
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`
}
