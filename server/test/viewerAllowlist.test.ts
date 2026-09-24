import { describe, expect, it } from 'vitest'
import { isAllowed, parseNetworks } from '../src/viewerAllowlist.js'

describe('viewer allowlist', () => {
  const { networks } = parseNetworks('192.168.10.0/24, 10.0.0.5, fd00::/8')

  it('matches CIDRs and single IPs', () => {
    expect(isAllowed('192.168.10.44', networks)).toBe(true)
    expect(isAllowed('10.0.0.5', networks)).toBe(true)
    expect(isAllowed('10.0.0.6', networks)).toBe(false)
    expect(isAllowed('8.8.8.8', networks)).toBe(false)
  })

  it('handles IPv4-mapped IPv6 and IPv6', () => {
    expect(isAllowed('::ffff:192.168.10.44', networks)).toBe(true)
    expect(isAllowed('fd12::1', networks)).toBe(true)
  })

  it('matches the church /22 (192.168.0.0 – 192.168.3.255) and nothing next to it', () => {
    const church = parseNetworks('192.168.0.0/22').networks
    expect(isAllowed('192.168.0.1', church)).toBe(true)
    expect(isAllowed('192.168.3.254', church)).toBe(true)
    expect(isAllowed('192.168.4.1', church)).toBe(false)
    expect(isAllowed('192.169.0.1', church)).toBe(false)
  })

  it('fails closed', () => {
    expect(isAllowed(undefined, networks)).toBe(false)
    expect(isAllowed('garbage', networks)).toBe(false)
    expect(isAllowed('192.168.10.44', [])).toBe(false)
  })
})
