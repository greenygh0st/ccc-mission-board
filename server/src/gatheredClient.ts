import { Agent, fetch as undiciFetch } from 'undici'
import type { GatheredBoardResponse, GatheredBranding } from './types.js'

export class GatheredError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message)
  }
}

export interface GatheredClientOptions {
  baseUrl: string
  token: string
  forwardedProto: string | null
  /** Pin connections to IPv4 or IPv6 (null = let Node choose). */
  ipFamily?: 4 | 6 | null
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

const MAX_REDIRECTS = 5

/**
 * Talks to Gathered. Everything goes through `baseUrl` (often the internal
 * Docker hostname, e.g. http://api:3000), including image URLs: Gathered
 * builds absolute URLs from the Host it was called with, so those URLs (and
 * the ActiveStorage redirects behind them) point at a host the kiosk browser
 * can't reach. `toBaseUrl` re-homes any URL on Gathered's own host onto
 * `baseUrl`; foreign hosts (e.g. an S3 presigned URL) are fetched as-is.
 */
export class GatheredClient {
  private readonly base: URL
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(private readonly opts: GatheredClientOptions) {
    this.base = new URL(opts.baseUrl)
    this.fetchImpl = opts.fetchImpl ?? pinnedFetch(opts.ipFamily ?? null)
    this.timeoutMs = opts.timeoutMs ?? 15_000
  }

  async fetchBoard(): Promise<GatheredBoardResponse> {
    const res = await this.request(this.resolve('/api/v1/board/missionaries'), { auth: true })
    if (!res.ok) {
      // 404 is how Gathered says "wrong network / bad or revoked token /
      // feed disabled" — deliberately indistinguishable from outside.
      const hint = res.status === 404 ? ' (check the board token and that this server\'s IP is allowlisted in Gathered)' : ''
      throw new GatheredError(`Gathered board feed returned ${res.status}${hint}`, res.status)
    }
    const json = (await res.json()) as GatheredBoardResponse
    if (!json || !Array.isArray(json.missionaries)) {
      throw new GatheredError('Gathered board feed returned an unexpected shape', res.status)
    }
    return json
  }

  async fetchBranding(): Promise<GatheredBranding> {
    const res = await this.request(this.resolve('/api/v1/public/branding'), { auth: false })
    if (!res.ok) throw new GatheredError(`Gathered branding returned ${res.status}`, res.status)
    return (await res.json()) as GatheredBranding
  }

  /** Downloads an image, following ActiveStorage redirects safely. */
  async fetchImage(url: string): Promise<Buffer> {
    let target = this.toBaseUrl(url)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const onGathered = target.host === this.base.host
      const res = await this.request(target, { auth: false, gatheredHeaders: onGathered, redirect: 'manual' })
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) throw new GatheredError('Image redirect without a Location', res.status)
        target = this.toBaseUrl(new URL(location, target).toString())
        continue
      }
      if (!res.ok) throw new GatheredError(`Image fetch returned ${res.status}`, res.status)
      return Buffer.from(await res.arrayBuffer())
    }
    throw new GatheredError('Too many image redirects', null)
  }

  /** Re-homes a Gathered URL (any scheme, Gathered's host) onto baseUrl. */
  toBaseUrl(url: string): URL {
    const parsed = new URL(url, this.base)
    if (parsed.host === this.base.host || parsed.pathname.startsWith('/rails/active_storage/')) {
      return this.resolve(parsed.pathname + parsed.search)
    }
    return parsed
  }

  private resolve(pathAndQuery: string): URL {
    return new URL(pathAndQuery, this.base)
  }

  private async request(
    url: URL,
    { auth, gatheredHeaders = true, redirect = 'follow' }: { auth: boolean; gatheredHeaders?: boolean; redirect?: RequestRedirect },
  ): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json, image/*' }
    if (gatheredHeaders) {
      if (auth) headers.Authorization = `Bearer ${this.opts.token}`
      if (this.opts.forwardedProto) headers['X-Forwarded-Proto'] = this.opts.forwardedProto
    }
    try {
      return await this.fetchImpl(url, { headers, redirect, signal: AbortSignal.timeout(this.timeoutMs) })
    } catch (err) {
      throw new GatheredError(`Could not reach Gathered at ${url.origin}: ${(err as Error).message}`, null)
    }
  }
}

/** fetch that only connects over the given IP family (Gathered's allowlist is per address). */
export function pinnedFetch(family: 4 | 6 | null): typeof fetch {
  if (!family) return fetch
  // undici's typings demand a port here, but it's filled in per request.
  const dispatcher = new Agent({ connect: { family, autoSelectFamily: false } as unknown as Agent.Options['connect'] })
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    undiciFetch(input as never, { ...(init as object), dispatcher } as never)) as unknown as typeof fetch
}
