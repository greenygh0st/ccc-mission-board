import { describe, expect, it } from 'vitest'
import { BoardStore, toBoardResponse } from '../src/boardStore.js'
import { GatheredError } from '../src/gatheredClient.js'
import { ImageCache } from '../src/imageCache.js'
import { board, missionary, silentLog, testConfig, tmpDir } from './helpers.js'

const register = (url: string) => ({ thumb: `/media/${ImageCache.keyFor(url)}/thumb`, full: `/media/${ImageCache.keyFor(url)}/full` })

describe('toBoardResponse', () => {
  const config = testConfig()

  it('derives latestUpdates newest-first across missionaries, tagged with missionaryId', () => {
    const res = toBoardResponse(
      {
        board: board([
          missionary({ id: 'a', name: 'A', updates: [{ id: 'u1', title: null, body: 'old', published_at: '2026-01-01T00:00:00Z', image_urls: [] }] }),
          missionary({ id: 'b', name: 'B', updates: [{ id: 'u2', title: null, body: 'new', published_at: '2026-09-01T00:00:00Z', image_urls: [] }] }),
        ]),
        branding: null,
        fetchedAt: 'now',
      },
      { config, stale: false, register },
    )
    expect(res.latestUpdates.map((u) => [u.id, u.missionaryId])).toEqual([['u2', 'b'], ['u1', 'a']])
  })

  it('passes sensitive missionaries through untouched — no enrichment, no coordinates invented', () => {
    const res = toBoardResponse(
      {
        board: board([missionary({ id: 's', name: 'The S. Family', region: 'Asia', sensitive: true })]),
        branding: null,
        fetchedAt: 'now',
      },
      { config, stale: false, register },
    )
    const s = res.missionaries[0]
    expect(s).toMatchObject({ name: 'The S. Family', region: 'Asia', sensitive: true, country: null, latitude: null, longitude: null, photo: null })
  })

  it('swaps image URLs for opaque /media keys (no Gathered host reaches the browser)', () => {
    const res = toBoardResponse(
      {
        board: board([missionary({ id: 'a', name: 'A', photo_url: 'http://api:3000/rails/active_storage/blobs/redirect/k/p.jpg' })]),
        branding: null,
        fetchedAt: 'now',
      },
      { config, stale: false, register },
    )
    expect(JSON.stringify(res)).not.toContain('api:3000')
    expect(res.missionaries[0].photo?.thumb).toMatch(/^\/media\/[0-9a-f]{40}\/thumb$/)
  })

  it('uses branding for church name/colors with sensible fallbacks', () => {
    const withBranding = toBoardResponse(
      { board: board([]), branding: { church_name: 'Grace Church', church_logo_url: null, church_wordmark_url: null, primary_color: '#000000', accent_color: null }, fetchedAt: 'now' },
      { config, stale: false, register },
    )
    expect(withBranding.church).toMatchObject({ name: 'Grace Church', primaryColor: '#000000', accentColor: '#BD7142' })
    const override = toBoardResponse({ board: board([]), branding: null, fetchedAt: 'now' }, { config: testConfig({ CHURCH_NAME: 'Home' }), stale: false, register })
    expect(override.church.name).toBe('Home')
  })
})

describe('BoardStore', () => {
  const images = () => new ImageCache('/tmp/unused-images', async () => Buffer.alloc(0))

  it('serves cached data marked stale when Gathered starts failing (never blanks)', async () => {
    let fail = false
    const source = {
      fetchBoard: async () => {
        if (fail) throw new GatheredError('Gathered board feed returned 404', 404)
        return board([missionary({ id: 'a', name: 'A' })])
      },
      fetchBranding: async () => { throw new Error('branding down') },
    }
    const store = new BoardStore(testConfig({}, await tmpDir()), source, images(), silentLog)

    await store.refresh()
    expect(store.getResponse()?.stale).toBe(false)

    fail = true
    await store.refresh()
    expect(store.getResponse()?.missionaries).toHaveLength(1)
    expect(store.getResponse()?.stale).toBe(true)
    expect(store.health()).toMatchObject({ stale: true, lastErrorStatus: 404 })
  })

  it('reloads the last snapshot from disk after a restart, as stale', async () => {
    const dir = await tmpDir()
    const source = { fetchBoard: async () => board([missionary({ id: 'a', name: 'A' })]), fetchBranding: async () => null as never }
    const first = new BoardStore(testConfig({}, dir), source, images(), silentLog)
    await first.refresh()

    const down = { fetchBoard: async () => { throw new Error('down') }, fetchBranding: async () => { throw new Error('down') } }
    const second = new BoardStore(testConfig({}, dir), down, images(), silentLog)
    await second.loadFromDisk()
    expect(second.getResponse()?.missionaries.map((m) => m.id)).toEqual(['a'])
    expect(second.getResponse()?.stale).toBe(true)
  })

  it('is not ready before the first successful fetch', () => {
    const store = new BoardStore(testConfig(), { fetchBoard: async () => board([]), fetchBranding: async () => null as never }, images(), silentLog)
    expect(store.getResponse()).toBeNull()
    expect(store.health().ready).toBe(false)
  })
})
