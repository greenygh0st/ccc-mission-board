import { describe, expect, it, vi } from 'vitest'
import { GatheredClient, GatheredError } from '../src/gatheredClient.js'
import { TOKEN } from './helpers.js'

function client(fetchImpl: typeof fetch) {
  return new GatheredClient({ baseUrl: 'http://api:3000', token: TOKEN, forwardedProto: 'https', fetchImpl })
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('GatheredClient', () => {
  it('sends the token only in the Authorization header, plus X-Forwarded-Proto', async () => {
    const fetchImpl = vi.fn(async () => json({ missionaries: [], generated_at: 'x' }))
    await client(fetchImpl as unknown as typeof fetch).fetchBoard()
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('http://api:3000/api/v1/board/missionaries')
    expect(url.search).toBe('')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`)
    expect((init.headers as Record<string, string>)['X-Forwarded-Proto']).toBe('https')
  })

  it('turns a 404 into a GatheredError with a setup hint', async () => {
    const c = client((async () => json({ error: 'Not found' }, 404)) as unknown as typeof fetch)
    await expect(c.fetchBoard()).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/allowlisted/) })
  })

  it('reports network failures as GatheredError', async () => {
    const c = client((async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch)
    await expect(c.fetchBoard()).rejects.toBeInstanceOf(GatheredError)
  })

  it('re-homes image URLs on Gathered\'s host (any scheme) onto the base URL', () => {
    const c = client(fetch)
    expect(c.toBaseUrl('https://api:3000/rails/active_storage/blobs/redirect/abc/p.jpg?x=1').toString())
      .toBe('http://api:3000/rails/active_storage/blobs/redirect/abc/p.jpg?x=1')
    expect(c.toBaseUrl('https://gathered.example.org/rails/active_storage/blobs/redirect/abc/p.jpg').toString())
      .toBe('http://api:3000/rails/active_storage/blobs/redirect/abc/p.jpg')
    expect(c.toBaseUrl('https://s3.example.com/bucket/key?sig=1').host).toBe('s3.example.com')
  })

  it('follows ActiveStorage redirects, re-homing same-host hops and never sending the token off-host', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    const fetchImpl = vi.fn(async (url: URL, init: RequestInit) => {
      calls.push({ url: url.toString(), headers: init.headers as Record<string, string> })
      if (url.pathname.startsWith('/rails/active_storage/blobs/redirect')) {
        return new Response(null, { status: 302, headers: { location: 'https://api:3000/rails/active_storage/disk/xyz/p.jpg' } })
      }
      if (url.pathname.startsWith('/rails/active_storage/disk')) {
        return new Response(null, { status: 302, headers: { location: 'https://s3.example.com/b/p.jpg?sig=1' } })
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    })
    const buf = await client(fetchImpl as unknown as typeof fetch).fetchImage('https://api:3000/rails/active_storage/blobs/redirect/abc/p.jpg')

    expect([...buf]).toEqual([1, 2, 3])
    expect(calls.map((c) => c.url)).toEqual([
      'http://api:3000/rails/active_storage/blobs/redirect/abc/p.jpg',
      'http://api:3000/rails/active_storage/disk/xyz/p.jpg',
      'https://s3.example.com/b/p.jpg?sig=1',
    ])
    for (const c of calls) expect(c.headers.Authorization).toBeUndefined()
    expect(calls[2].headers['X-Forwarded-Proto']).toBeUndefined()
  })

  it('gives up after too many redirects', async () => {
    const fetchImpl = async () => new Response(null, { status: 302, headers: { location: '/rails/active_storage/loop' } })
    await expect(client(fetchImpl as unknown as typeof fetch).fetchImage('http://api:3000/rails/active_storage/loop'))
      .rejects.toThrow(/Too many/)
  })
})
