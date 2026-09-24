import { readdir, utimes } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import { ImageCache } from '../src/imageCache.js'
import { tmpDir } from './helpers.js'

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#336699' } }).png().toBuffer()

describe('ImageCache', () => {
  it('keys by path so internal and public URLs of the same blob share a cache entry', () => {
    expect(ImageCache.keyFor('http://api:3000/rails/active_storage/blobs/redirect/k/p.jpg'))
      .toBe(ImageCache.keyFor('https://gathered.example.org/rails/active_storage/blobs/redirect/k/p.jpg'))
  })

  it('resizes to WebP, caches on disk, and fetches the source only once', async () => {
    const dir = await tmpDir()
    const fetcher = vi.fn(async () => png(3000, 2000))
    const cache = new ImageCache(dir, fetcher)
    const key = ImageCache.keyFor('mock://x')
    cache.setSources(new Map([[key, 'mock://x']]))

    const thumb = await cache.get(key, 'thumb')
    const meta = await sharp(thumb!).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(400)

    await cache.get(key, 'thumb')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('returns null for unknown keys (never fetches arbitrary URLs)', async () => {
    const fetcher = vi.fn()
    const cache = new ImageCache(await tmpDir(), fetcher)
    expect(await cache.get('0'.repeat(40), 'full')).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('prunes unreferenced files only after the grace period', async () => {
    const dir = await tmpDir()
    const cache = new ImageCache(dir, async () => png(10, 10))
    const key = ImageCache.keyFor('mock://gone')
    cache.setSources(new Map([[key, 'mock://gone']]))
    await cache.get(key, 'thumb')
    cache.setSources(new Map())

    expect(await cache.prune()).toBe(0)
    const old = new Date(Date.now() - 8 * 86_400_000)
    await utimes(path.join(dir, `${key}-thumb.webp`), old, old)
    expect(await cache.prune()).toBe(1)
    expect(await readdir(dir)).toEqual([])
  })
})
