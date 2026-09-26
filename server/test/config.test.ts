import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'
import { TOKEN } from './helpers.js'

const valid = {
  GATHERED_BASE_URL: 'http://api:3000/',
  GATHERED_BOARD_TOKEN: TOKEN,
  VIEWER_ALLOWED_NETWORKS: '192.168.10.45',
}

describe('loadConfig', () => {
  it('accepts a valid environment and normalizes the base URL', () => {
    const c = loadConfig(valid)
    expect(c.gathered.baseUrl).toBe('http://api:3000')
    expect(c.gathered.token).toBe(TOKEN)
  })

  it('defaults X-Forwarded-Proto to https for a plain-http base URL (Gathered force_ssl)', () => {
    expect(loadConfig(valid).gathered.forwardedProto).toBe('https')
    expect(loadConfig({ ...valid, GATHERED_BASE_URL: 'https://gathered.example.org' }).gathered.forwardedProto).toBeNull()
    expect(loadConfig({ ...valid, GATHERED_FORWARDED_PROTO: 'none' }).gathered.forwardedProto).toBeNull()
  })

  it('connects to Gathered over IPv4 by default (its allowlist is per address)', () => {
    expect(loadConfig(valid).gathered.ipFamily).toBe(4)
    expect(loadConfig({ ...valid, GATHERED_IP_FAMILY: '6' }).gathered.ipFamily).toBe(6)
    expect(loadConfig({ ...valid, GATHERED_IP_FAMILY: 'auto' }).gathered.ipFamily).toBeNull()
    expect(() => loadConfig({ ...valid, GATHERED_IP_FAMILY: '5' })).toThrow(/GATHERED_IP_FAMILY/)
  })

  it('fails fast with a clear message when the token is missing or malformed', () => {
    expect(() => loadConfig({ ...valid, GATHERED_BOARD_TOKEN: undefined })).toThrow(/GATHERED_BOARD_TOKEN/)
    expect(() => loadConfig({ ...valid, GATHERED_BOARD_TOKEN: 'gathered_nope' })).toThrow(/GATHERED_BOARD_TOKEN/)
  })

  it('requires a base URL', () => {
    expect(() => loadConfig({ ...valid, GATHERED_BASE_URL: 'not a url' })).toThrow(/GATHERED_BASE_URL/)
  })

  it('requires VIEWER_ALLOWED_NETWORKS (no permissive default) and validates it', () => {
    expect(() => loadConfig({ ...valid, VIEWER_ALLOWED_NETWORKS: undefined })).toThrow(/VIEWER_ALLOWED_NETWORKS/)
    expect(() => loadConfig({ ...valid, VIEWER_ALLOWED_NETWORKS: '192.168.10.0/24, bogus' })).toThrow(/bogus/)
  })

  it('adds Cloudflare ranges to the trusted proxies only when asked', () => {
    expect(loadConfig({ ...valid, TRUST_PROXY: '172.20.0.2' }).trustProxy).toEqual(['172.20.0.2'])
    const cf = loadConfig({ ...valid, TRUST_PROXY: '172.20.0.2', TRUST_CLOUDFLARE: '1' }).trustProxy as string[]
    expect(cf).toContain('172.20.0.2')
    expect(cf).toContain('172.64.0.0/13')
    expect(loadConfig(valid).trustProxy).toBe(false)
  })

  it('does not require Gathered settings in mock mode', () => {
    const c = loadConfig({ MOCK_GATHERED: '1', VIEWER_ALLOWED_NETWORKS: '127.0.0.1' })
    expect(c.mock).toBe(true)
  })
})
