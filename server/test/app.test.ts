import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { BoardStore } from '../src/boardStore.js'
import { ImageCache } from '../src/imageCache.js'
import { board, missionary, silentLog, testConfig, tmpDir } from './helpers.js'

async function setup(overrides: Record<string, string> = {}) {
  const config = testConfig(overrides, await tmpDir())
  const images = new ImageCache(await tmpDir(), async () => Buffer.alloc(0))
  const store = new BoardStore(config, { fetchBoard: async () => board([missionary({ id: 'a', name: 'A' })]), fetchBranding: async () => null as never }, images, silentLog)
  await store.refresh()
  return buildApp(config, store, images, { logger: false })
}

describe('HTTP app', () => {
  it('serves the board to an allowed viewer, with no-store and a strict CSP', async () => {
    const app = await setup()
    const res = await app.inject({ url: '/api/board', remoteAddress: '192.168.10.44' })
    expect(res.statusCode).toBe(200)
    expect(res.json().missionaries[0].id).toBe('a')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['content-security-policy']).toContain("default-src 'self'")
  })

  it('404s for viewers outside VIEWER_ALLOWED_NETWORKS', async () => {
    const app = await setup()
    const res = await app.inject({ url: '/api/board', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(404)
  })

  it('ignores a spoofed X-Forwarded-For when no proxy is trusted', async () => {
    const app = await setup()
    const res = await app.inject({ url: '/api/board', remoteAddress: '8.8.8.8', headers: { 'x-forwarded-for': '192.168.10.44' } })
    expect(res.statusCode).toBe(404)
  })

  it('honours X-Forwarded-For only from the trusted proxy', async () => {
    const app = await setup({ TRUST_PROXY: '172.20.0.2' })
    const viaProxy = await app.inject({ url: '/api/board', remoteAddress: '172.20.0.2', headers: { 'x-forwarded-for': '192.168.10.44' } })
    expect(viaProxy.statusCode).toBe(200)
    const outsiderViaProxy = await app.inject({ url: '/api/board', remoteAddress: '172.20.0.2', headers: { 'x-forwarded-for': '192.168.10.44, 8.8.8.8' } })
    expect(outsiderViaProxy.statusCode).toBe(404)
    const notTheProxy = await app.inject({ url: '/api/board', remoteAddress: '172.20.0.9', headers: { 'x-forwarded-for': '192.168.10.44' } })
    expect(notTheProxy.statusCode).toBe(404)
  })

  it('keeps /healthz reachable for the container healthcheck without exposing data', async () => {
    const app = await setup()
    const res = await app.inject({ url: '/healthz', remoteAddress: '127.0.0.1' })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('"A"')
    expect(res.json()).toMatchObject({ ok: true, stale: false, missionaryCount: 1 })
  })

  it('reports the resolved viewer IP on /healthz (behind the proxy) for setup checks', async () => {
    const app = await setup({ TRUST_PROXY: '172.20.0.2' })
    const res = await app.inject({ url: '/healthz', remoteAddress: '172.20.0.2', headers: { 'x-forwarded-for': '192.168.10.44' } })
    expect(res.json()).toMatchObject({ yourIp: '192.168.10.44', yourIpAllowed: true })
  })

  it('rejects malformed media keys and sizes', async () => {
    const app = await setup()
    expect((await app.inject({ url: '/media/../../etc/passwd/full', remoteAddress: '192.168.10.44' })).statusCode).toBe(404)
    expect((await app.inject({ url: `/media/${'a'.repeat(40)}/huge`, remoteAddress: '192.168.10.44' })).statusCode).toBe(404)
  })
})
