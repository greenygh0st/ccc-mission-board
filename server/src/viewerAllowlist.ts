import ipaddr from 'ipaddr.js'

export type Network = [ipaddr.IPv4 | ipaddr.IPv6, number]

// Parses a comma-separated list of IPs/CIDRs ("192.168.10.45, 10.1.0.0/24").
export function parseNetworks(raw: string): { networks: Network[]; errors: string[] } {
  const networks: Network[] = []
  const errors: string[] = []
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      if (entry.includes('/')) {
        networks.push(ipaddr.parseCIDR(entry))
      } else {
        const addr = ipaddr.parse(entry)
        networks.push([addr, addr.kind() === 'ipv4' ? 32 : 128])
      }
    } catch {
      errors.push(`"${entry}" is not a valid IP address or CIDR range`)
    }
  }
  return { networks, errors }
}

// Fail closed: an unparseable client address or an empty list allows nothing.
export function isAllowed(ip: string | undefined, networks: Network[]): boolean {
  if (!ip) return false
  let addr: ipaddr.IPv4 | ipaddr.IPv6
  try {
    addr = ipaddr.process(ip) // unwraps IPv4-mapped IPv6 (::ffff:1.2.3.4)
  } catch {
    return false
  }
  return networks.some(([net, bits]) => net.kind() === addr.kind() && addr.match(net, bits))
}
