import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { BoardStore } from '../src/boardStore.js'
import { loadConfig } from '../src/config.js'
import { ImageCache } from '../src/imageCache.js'
import { MockSource, renderMockImage } from '../src/mock/mockSource.js'
import { silentLog, tmpDir } from './helpers.js'

describe('mock mode end to end', () => {
  it('serves the fixture feed and real resized WebP images through /media', async () => {
    const dir = await tmpDir()
    const config = loadConfig({ MOCK_GATHERED: '1', VIEWER_ALLOWED_NETWORKS: '127.0.0.1', DATA_DIR: dir, WEB_DIST: '/nonexistent' })
    const images = new ImageCache(path.join(dir, 'images'), renderMockImage)
    const store = new BoardStore(config, new MockSource(), images, silentLog)
    await store.refresh()
    const app = buildApp(config, store, images, { logger: false })

    const res = await app.inject({ url: '/api/board', remoteAddress: '127.0.0.1' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.missionaries.length).toBeGreaterThan(10)
    expect(body.latestUpdates.length).toBeGreaterThan(3)
    // Fixture's sensitive records arrive redacted, exactly as Gathered sends them
    const sensitive = body.missionaries.filter((m: { sensitive: boolean }) => m.sensitive)
    expect(sensitive.length).toBe(2)
    for (const m of sensitive) expect(m).toMatchObject({ latitude: null, longitude: null, country: null, photo: null })

    const photo = body.missionaries.find((m: { photo: unknown }) => m.photo).photo
    const img = await app.inject({ url: photo.full, remoteAddress: '127.0.0.1' })
    expect(img.statusCode).toBe(200)
    expect(img.headers['content-type']).toBe('image/webp')
    expect((await sharp(img.rawPayload).metadata()).format).toBe('webp')
  })
})
