import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Config } from './config.js'
import { GatheredError } from './gatheredClient.js'
import { ImageCache } from './imageCache.js'
import type {
  BoardImage,
  BoardMissionary,
  BoardResponse,
  BoardUpdate,
  GatheredBoardResponse,
  GatheredBranding,
  GatheredMissionary,
} from './types.js'

export interface BoardSource {
  fetchBoard(): Promise<GatheredBoardResponse>
  fetchBranding(): Promise<GatheredBranding>
}

interface Snapshot {
  board: GatheredBoardResponse
  branding: GatheredBranding | null
  fetchedAt: string
}

type LogFn = (obj: object, msg?: string) => void
/** Fastify's pino logger or `console` (used until Fastify is up). */
export interface Logger {
  info: LogFn
  warn: LogFn
  error: LogFn
}

const DEFAULT_PRIMARY = '#133A49'
const DEFAULT_ACCENT = '#BD7142'

/**
 * Pure transform from Gathered's payload to what the browser gets. Values are
 * passed through as-is — in particular sensitive missionaries are NOT
 * enriched or altered (Gathered already redacted them; see the handoff doc).
 * The only changes are camelCasing and swapping image URLs for /media keys.
 */
export function toBoardResponse(
  snapshot: Snapshot,
  opts: {
    config: Pick<Config, 'church' | 'idleSeconds' | 'spotlightSeconds' | 'clientPollSeconds' | 'latestUpdatesCount'>
    stale: boolean
    register: (sourceUrl: string) => BoardImage
  },
): BoardResponse {
  const { board, branding } = snapshot
  const img = (url: string | null | undefined) => (url ? opts.register(url) : null)

  const missionaries: BoardMissionary[] = board.missionaries.map((m: GatheredMissionary) => ({
    id: m.id,
    name: m.name,
    region: m.region,
    sensitive: m.sensitive === true,
    ministryFocus: m.ministry_focus,
    memberNames: m.member_names,
    organization: m.organization,
    country: m.country,
    latitude: m.latitude,
    longitude: m.longitude,
    bio: m.bio,
    servingSince: m.serving_since,
    websiteUrl: m.website_url,
    photo: img(m.photo_url),
    updates: (m.updates ?? []).map(
      (u): BoardUpdate => ({
        id: u.id,
        missionaryId: m.id,
        title: u.title,
        body: u.body,
        publishedAt: u.published_at,
        images: (u.image_urls ?? []).map((url) => opts.register(url)),
      }),
    ),
  }))

  const latestUpdates = missionaries
    .flatMap((m) => m.updates)
    .sort((a, b) => Date.parse(b.publishedAt ?? '0') - Date.parse(a.publishedAt ?? '0'))
    .slice(0, opts.config.latestUpdatesCount)

  return {
    missionaries,
    latestUpdates,
    church: {
      name: opts.config.church.name ?? branding?.church_name ?? 'Our Church',
      lat: opts.config.church.lat,
      lng: opts.config.church.lng,
      logo: img(branding?.church_logo_url),
      wordmark: img(branding?.church_wordmark_url),
      primaryColor: branding?.primary_color ?? DEFAULT_PRIMARY,
      accentColor: branding?.accent_color ?? DEFAULT_ACCENT,
    },
    settings: {
      idleSeconds: opts.config.idleSeconds,
      spotlightSeconds: opts.config.spotlightSeconds,
      clientPollSeconds: opts.config.clientPollSeconds,
    },
    fetchedAt: snapshot.fetchedAt,
    stale: opts.stale,
  }
}

export interface BoardHealth {
  ready: boolean
  stale: boolean
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  lastErrorStatus: number | null
  lastError: string | null
  missionaryCount: number
}

/**
 * Polls Gathered and keeps the last good snapshot in memory and on disk, so a
 * restart or a Gathered outage never blanks the wall — the board just goes
 * `stale` until the next successful poll.
 */
export class BoardStore {
  private snapshot: Snapshot | null = null
  private response: BoardResponse | null = null
  private stale = true
  private lastAttemptAt: string | null = null
  private lastError: GatheredError | Error | null = null
  private timer: NodeJS.Timeout | null = null
  private refreshing: Promise<void> | null = null

  constructor(
    private readonly config: Config,
    private readonly source: BoardSource,
    private readonly images: ImageCache,
    private log: Logger,
  ) {}

  setLogger(log: Logger) {
    this.log = log
  }

  private get snapshotFile() {
    return path.join(this.config.dataDir, 'board.json')
  }

  async loadFromDisk() {
    try {
      const snap = JSON.parse(await readFile(this.snapshotFile, 'utf8')) as Snapshot
      if (snap?.board?.missionaries) {
        this.snapshot = snap
        this.stale = true
        this.rebuild()
        this.log.info({ fetchedAt: snap.fetchedAt }, 'Loaded cached board snapshot from disk')
      }
    } catch {
      /* first boot — nothing cached */
    }
  }

  start() {
    const tick = () => {
      void this.refresh().finally(() => {
        this.timer = setTimeout(tick, this.config.pollSeconds * 1000)
      })
    }
    tick()
  }

  stop() {
    if (this.timer) clearTimeout(this.timer)
  }

  refresh(): Promise<void> {
    this.refreshing ??= this.doRefresh().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  private async doRefresh() {
    this.lastAttemptAt = new Date().toISOString()
    try {
      const board = await this.source.fetchBoard()
      // Branding is cosmetic — never let it fail the poll.
      const branding = await this.source.fetchBranding().catch((err) => {
        this.log.warn({ err: (err as Error).message }, 'Could not fetch Gathered branding; using defaults')
        return this.snapshot?.branding ?? null
      })
      this.snapshot = { board, branding, fetchedAt: new Date().toISOString() }
      this.stale = false
      this.lastError = null
      this.rebuild()
      await this.persist()
      // Missionary names/content are deliberately not logged.
      this.log.info({ missionaries: board.missionaries.length }, 'Board refreshed from Gathered')
      void this.images.prefetchAll().then(async (r) => {
        if (r.failed) this.log.warn(r, 'Some images failed to prefetch')
        await this.images.prune()
      })
    } catch (err) {
      this.lastError = err as Error
      this.stale = true
      if (this.snapshot) this.rebuild()
      this.log.error(
        { status: (err as GatheredError).status ?? null, err: (err as Error).message },
        'Board refresh failed; serving cached data',
      )
    }
  }

  private rebuild() {
    if (!this.snapshot) return
    const sources = new Map<string, string>()
    const register = (sourceUrl: string): BoardImage => {
      const key = ImageCache.keyFor(sourceUrl)
      sources.set(key, sourceUrl)
      return { thumb: `/media/${key}/thumb`, full: `/media/${key}/full` }
    }
    this.response = toBoardResponse(this.snapshot, { config: this.config, stale: this.stale, register })
    this.images.setSources(sources)
  }

  private async persist() {
    await mkdir(this.config.dataDir, { recursive: true })
    const tmp = `${this.snapshotFile}.tmp`
    await writeFile(tmp, JSON.stringify(this.snapshot))
    await rename(tmp, this.snapshotFile)
  }

  getResponse(): BoardResponse | null {
    return this.response
  }

  health(): BoardHealth {
    return {
      ready: this.response !== null,
      stale: this.stale,
      lastSuccessAt: this.snapshot?.fetchedAt ?? null,
      lastAttemptAt: this.lastAttemptAt,
      lastErrorStatus: this.lastError instanceof GatheredError ? this.lastError.status : null,
      lastError: this.lastError?.message ?? null,
      missionaryCount: this.snapshot?.board.missionaries.length ?? 0,
    }
  }
}
