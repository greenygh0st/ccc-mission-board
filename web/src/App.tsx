import { AnimatePresence, motion } from 'framer-motion'
import { Hand } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import Lightbox from './components/Lightbox'
import MissionaryDetail from './components/MissionaryDetail'
import MissionaryStrip from './components/MissionaryStrip'
import OverviewPanel from './components/OverviewPanel'
import SpotlightPanel from './components/SpotlightPanel'
import StatusDot from './components/StatusDot'
import { countryCode, placeMissionaries } from './globe/geo'
import { useBoard } from './hooks/useBoard'
import { useIdle } from './hooks/useIdle'
import { useLayout, useReducedMotion, type Layout } from './hooks/useLayout'
import { useSpotlight } from './hooks/useSpotlight'
import { installKioskGuards, scheduleNightlyReload } from './lib/kiosk'
import { isRecent } from './lib/time'
import type { BoardImage, BoardMissionary, BoardResponse } from './types'

// three.js is heavy — let the shell paint first.
const MissionGlobe = lazy(() => import('./globe/MissionGlobe'))

export default function App() {
  const [pollSeconds, setPollSeconds] = useState(60)
  const { data } = useBoard(pollSeconds)

  useEffect(() => installKioskGuards(), [])
  useEffect(() => scheduleNightlyReload(), [])
  useEffect(() => {
    if (data) setPollSeconds(data.settings.clientPollSeconds)
  }, [data?.settings.clientPollSeconds])

  return (
    <ErrorBoundary>
      {data ? <Board data={data} /> : <Connecting />}
    </ErrorBoundary>
  )
}

function Connecting() {
  return (
    <div className="starfield relative grid h-full place-items-center">
      <div className="relative flex flex-col items-center gap-4 text-center">
        <span className="size-4 animate-ping rounded-full bg-accent" />
        <p className="font-display text-kiosk-xl text-cream/85">Gathering the latest from the field…</p>
      </div>
    </div>
  )
}

export function Board({ data }: { data: BoardResponse }) {
  const layout = useLayout()
  const reducedMotion = useReducedMotion()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<{ images: BoardImage[]; index: number } | null>(null)
  const { idle } = useIdle(data.settings.idleSeconds * 1000)

  // Brand colours from Gathered
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--brand-primary', data.church.primaryColor)
    root.setProperty('--brand-accent', data.church.accentColor)
  }, [data.church.primaryColor, data.church.accentColor])

  const byId = useMemo(() => new Map(data.missionaries.map((m) => [m.id, m])), [data.missionaries])
  const { placed } = useMemo(() => placeMissionaries(data.missionaries), [data.missionaries])
  const placedIds = useMemo(() => new Set(placed.map((p) => p.missionary.id)), [placed])
  const recentIds = useMemo(
    () => new Set(data.missionaries.filter((m) => isRecent(m.updates[0]?.publishedAt)).map((m) => m.id)),
    [data.missionaries],
  )
  const stripGroups = useMemo(() => groupForStrip(data.missionaries), [data.missionaries])
  const stats = useMemo(() => {
    const codes = new Set(data.missionaries.filter((m) => !m.sensitive).map((m) => countryCode(m.country)).filter(Boolean))
    return { missionaries: data.missionaries.length, countries: codes.size }
  }, [data.missionaries])

  // Attract mode: reset to overview and cycle through who has news.
  useEffect(() => {
    if (idle) {
      setSelectedId(null)
      setLightbox(null)
    }
  }, [idle])
  const spotlightIds = useMemo(() => spotlightOrder(data.missionaries), [data.missionaries])
  const spotlightId = useSpotlight(spotlightIds, idle, data.settings.spotlightSeconds * 1000)

  // A missionary removed from Gathered while selected → back to overview.
  const selected = selectedId ? byId.get(selectedId) : undefined
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null)
  }, [selectedId, selected])

  const focusCandidate = selectedId ?? spotlightId
  const focusId = focusCandidate && placedIds.has(focusCandidate) ? focusCandidate : null
  const spotlight = spotlightId ? byId.get(spotlightId) : undefined

  const vars = {
    '--rail-w': `${layout.railW}px`,
    '--strip-h': `${layout.stripH}px`,
  } as CSSProperties

  let panel: React.ReactNode
  if (selected) {
    panel = (
      <MissionaryDetail
        key={selected.id}
        missionary={selected}
        onBack={() => setSelectedId(null)}
        onOpenImage={(images, index) => setLightbox({ images, index })}
      />
    )
  } else if (idle && spotlight) {
    panel = <SpotlightPanel key={`spot-${spotlight.id}`} missionary={spotlight} />
  } else {
    panel = (
      <OverviewPanel
        key="overview"
        updates={data.latestUpdates.slice(0, 3)}
        byId={byId}
        stats={stats}
        onSelect={setSelectedId}
        onOpenImage={(u, index) => setLightbox({ images: u.images, index })}
      />
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden" style={vars}>
      <div className="starfield absolute inset-0" />

      <div className="absolute inset-0" data-testid="globe-layer">
        <Suspense fallback={null}>
          <MissionGlobe
            width={layout.width}
            height={layout.height}
            offset={layout.globeOffset}
            placed={placed}
            home={{ lat: data.church.lat, lng: data.church.lng, name: 'Home' }}
            accent={data.church.accentColor}
            focusId={focusId}
            recentIds={recentIds}
            autoRotate={idle && !focusId}
            reducedMotion={reducedMotion}
            altitudeScale={layout.altitudeScale}
            onSelect={setSelectedId}
          />
        </Suspense>
      </div>

      <TopBar data={data} layout={layout} showHint={!idle && !selected} />

      <aside className="glass absolute flex flex-col overflow-hidden rounded-[clamp(20px,1.8vw,40px)] p-[clamp(18px,1.6vw,40px)]" style={railStyle(layout)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selected ? `m-${selected.id}` : idle && spotlight ? `s-${spotlight.id}` : 'overview'}
            className="h-full min-h-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.35 }}
          >
            {panel}
          </motion.div>
        </AnimatePresence>
      </aside>

      <div className="absolute inset-x-0" style={stripStyle(layout)}>
        <MissionaryStrip groups={stripGroups} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <Lightbox images={lightbox?.images ?? null} startIndex={lightbox?.index ?? 0} onClose={() => setLightbox(null)} />
    </div>
  )
}

function TopBar({ data, layout, showHint }: { data: BoardResponse; layout: Layout; showHint: boolean }) {
  const logo = data.church.wordmark ?? data.church.logo
  return (
    <div
      className="pointer-events-none absolute top-[var(--gutter)] right-[var(--gutter)] flex flex-col items-end gap-3"
      style={layout.portrait ? { left: 'var(--gutter)' } : { left: `calc(${layout.railW}px + var(--gutter) * 2)` }}
    >
      <div className="flex items-center gap-4">
        <StatusDot stale={data.stale} fetchedAt={data.fetchedAt} />
        {logo ? (
          <img src={logo.full} alt={data.church.name} className="h-[clamp(40px,4vw,96px)] w-auto object-contain drop-shadow-lg" draggable={false} />
        ) : (
          <p className="font-display text-kiosk-lg font-semibold text-cream/90 drop-shadow-lg">{data.church.name}</p>
        )}
      </div>
      <AnimatePresence>
        {showHint && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-full bg-space/55 px-4 py-2 text-kiosk-sm text-cream/85 backdrop-blur"
          >
            <Hand className="size-[1.1em] text-accent" aria-hidden /> Tap a light to meet our missionaries
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function railStyle(l: Layout): CSSProperties {
  if (l.portrait) {
    return { left: 'var(--gutter)', right: 'var(--gutter)', bottom: 'var(--gutter)', height: l.sheetH }
  }
  return { left: 'var(--gutter)', top: 'var(--gutter)', bottom: `calc(${l.stripH}px + var(--gutter))`, width: l.railW }
}

function stripStyle(l: Layout): CSSProperties {
  if (l.portrait) return { bottom: `calc(${l.sheetH}px + var(--gutter) * 1.5)`, height: l.stripH }
  return { bottom: 0, height: l.stripH }
}

/** Strip order: Gathered's display order, grouped by region; sensitive last. */
export function groupForStrip(missionaries: BoardMissionary[]) {
  const groups = new Map<string, { label: string; sensitive: boolean; missionaries: BoardMissionary[] }>()
  const sensitive: BoardMissionary[] = []
  for (const m of missionaries) {
    if (m.sensitive) {
      sensitive.push(m)
      continue
    }
    const label = m.region?.trim() || 'Around the world'
    if (!groups.has(label)) groups.set(label, { label, sensitive: false, missionaries: [] })
    groups.get(label)!.missionaries.push(m)
  }
  const out = [...groups.values()]
  if (sensitive.length) out.push({ label: 'Serving in sensitive locations', sensitive: true, missionaries: sensitive })
  return out
}

/** Attract-mode order: newest news first, then everyone with a photo. */
export function spotlightOrder(missionaries: BoardMissionary[]): string[] {
  const withNews = missionaries
    .filter((m) => m.updates.length > 0)
    .sort((a, b) => Date.parse(b.updates[0].publishedAt ?? '0') - Date.parse(a.updates[0].publishedAt ?? '0'))
  const rest = missionaries.filter((m) => m.updates.length === 0 && m.photo)
  return [...withNews, ...rest].map((m) => m.id)
}
