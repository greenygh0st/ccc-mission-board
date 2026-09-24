import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export type ImageSize = 'thumb' | 'full'
const WIDTHS: Record<ImageSize, number> = { thumb: 400, full: 1600 }
const PRUNE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

export type ImageFetcher = (sourceUrl: string) => Promise<Buffer>

/**
 * Serves Gathered images to the kiosk as resized WebP from a disk cache.
 *
 * Each source URL is registered under an opaque key (sha256 of its path —
 * ActiveStorage signed ids are stable per blob). The browser only ever sees
 * /media/<key>/<size>; the source URL and Gathered's host never leave the
 * server. Originals can be 10 MB, which is wasteful as GPU textures on a
 * 24/7 kiosk, hence the resize.
 */
export class ImageCache {
  private sources = new Map<string, string>()
  private inflight = new Map<string, Promise<Buffer>>()

  constructor(private readonly dir: string, private readonly fetcher: ImageFetcher) {}

  static keyFor(sourceUrl: string): string {
    let identity = sourceUrl
    try {
      const u = new URL(sourceUrl)
      identity = u.pathname // host-independent: internal vs public URL of the same blob
    } catch {
      /* non-URL identifiers (mock://…) hash as-is */
    }
    return createHash('sha256').update(identity).digest('hex').slice(0, 40)
  }

  /** Replaces the set of known images (called after every successful poll). */
  setSources(sources: Map<string, string>) {
    this.sources = sources
  }

  has(key: string) {
    return this.sources.has(key)
  }

  async get(key: string, size: ImageSize): Promise<Buffer | null> {
    const source = this.sources.get(key)
    if (!source) return null
    const file = this.fileFor(key, size)
    try {
      return await readFile(file)
    } catch {
      /* not cached yet */
    }
    const flightKey = `${key}:${size}`
    let pending = this.inflight.get(flightKey)
    if (!pending) {
      pending = this.render(source, size, file).finally(() => this.inflight.delete(flightKey))
      this.inflight.set(flightKey, pending)
    }
    return pending
  }

  /** Warms both sizes for every known image, a couple at a time. */
  async prefetchAll(concurrency = 2): Promise<{ ok: number; failed: number }> {
    const jobs = [...this.sources.keys()].flatMap((k) => [
      [k, 'thumb'],
      [k, 'full'],
    ]) as [string, ImageSize][]
    let ok = 0
    let failed = 0
    const worker = async () => {
      for (let job = jobs.shift(); job; job = jobs.shift()) {
        try {
          await this.get(job[0], job[1])
          ok++
        } catch {
          failed++
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, worker))
    return { ok, failed }
  }

  /** Deletes cached files for images no longer referenced, after a grace period. */
  async prune(now = Date.now()): Promise<number> {
    let removed = 0
    let files: string[] = []
    try {
      files = await readdir(this.dir)
    } catch {
      return 0
    }
    for (const name of files) {
      const key = name.split('-')[0]
      if (this.sources.has(key)) continue
      const full = path.join(this.dir, name)
      try {
        const { mtimeMs } = await stat(full)
        if (now - mtimeMs > PRUNE_AFTER_MS) {
          await unlink(full)
          removed++
        }
      } catch {
        /* raced with another delete */
      }
    }
    return removed
  }

  private fileFor(key: string, size: ImageSize) {
    return path.join(this.dir, `${key}-${size}.webp`)
  }

  private async render(source: string, size: ImageSize, file: string): Promise<Buffer> {
    const original = await this.fetcher(source)
    const out = await sharp(original, { failOn: 'error' })
      .rotate()
      .resize({ width: WIDTHS[size], withoutEnlargement: true })
      .webp({ quality: size === 'thumb' ? 78 : 84 })
      .toBuffer()
    await mkdir(this.dir, { recursive: true })
    const tmp = `${file}.${process.pid}.tmp`
    await writeFile(tmp, out)
    await rename(tmp, file)
    return out
  }
}
