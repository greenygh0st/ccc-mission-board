import { describe, expect, it } from 'vitest'
import { countryCentroid, countryCode, hexLandFeatures, placeMissionaries } from '../src/globe/geo'
import { overviewFor } from '../src/globe/MissionGlobe'
import { mis } from './fixtures'

describe('placeMissionaries', () => {
  it('NEVER places a sensitive missionary — even if coordinates or a country somehow arrive', () => {
    const leaked = mis('s', { sensitive: true, latitude: 39.9, longitude: 116.4, country: 'China' })
    const { placed, unplaced } = placeMissionaries([leaked])
    expect(placed).toEqual([])
    expect(unplaced.map((m) => m.id)).toEqual(['s'])
  })

  it('uses exact coordinates when present', () => {
    const { placed } = placeMissionaries([mis('a', { latitude: -1.29, longitude: 36.82, country: 'Kenya' })])
    expect(placed[0]).toMatchObject({ lat: -1.29, lng: 36.82, approximate: false })
  })

  it('falls back to the country centroid (main landmass) for non-sensitive missionaries', () => {
    const { placed } = placeMissionaries([mis('de', { country: 'Germany' }), mis('fr', { country: 'France' })])
    const de = placed.find((p) => p.missionary.id === 'de')!
    const fr = placed.find((p) => p.missionary.id === 'fr')!
    expect(de.approximate).toBe(true)
    expect(de.lat).toBeGreaterThan(47)
    expect(de.lat).toBeLessThan(55)
    // France's centroid stays in Europe, not dragged toward French Guiana
    expect(fr.lat).toBeGreaterThan(42)
    expect(fr.lng).toBeGreaterThan(-5)
  })

  it('leaves unknown/blank locations unplaced (strip only)', () => {
    const { placed, unplaced } = placeMissionaries([mis('x', { country: 'Atlantis' }), mis('y', {})])
    expect(placed).toEqual([])
    expect(unplaced.map((m) => m.id)).toEqual(['x', 'y'])
  })

  it('spreads missionaries at the same spot so each is tappable', () => {
    const { placed } = placeMissionaries([mis('a', { country: 'Kenya' }), mis('b', { country: 'Kenya' })])
    expect(placed).toHaveLength(2)
    expect(placed[0].lat !== placed[1].lat || placed[0].lng !== placed[1].lng).toBe(true)
  })
})

describe('hexSafeFeatures', () => {
  // Regression: North Korea's 110m polygon made H3 throw an uncaught error
  // from inside the globe's render loop.
  it('keeps every land shape H3 can process and drops the ones it can\'t', async () => {
    const { polygonToCells } = await import('h3-js')
    expect(hexLandFeatures.length).toBeGreaterThan(170)
    for (const f of hexLandFeatures) {
      const g = f.geometry as { type: string; coordinates: number[][][] | number[][][][] }
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as number[][][][]
      for (const coords of polys) expect(() => polygonToCells(coords, 3, true)).not.toThrow()
    }
  })

  it('still resolves the centroid of a country dropped from the dot layer', () => {
    expect(countryCentroid('North Korea')).not.toBeNull()
  })
})

describe('country resolution', () => {
  it('understands common free-text variants', () => {
    expect(countryCode('USA')).toBe('US')
    expect(countryCode('united kingdom')).toBe('GB')
    expect(countryCode(' Kenya ')).toBe('KE')
    expect(countryCode('ke')).toBe('KE')
    expect(countryCode('')).toBeNull()
  })

  it('returns null centroid for unknown countries', () => {
    expect(countryCentroid('Narnia')).toBeNull()
  })
})

describe('overviewFor', () => {
  it('centres the resting view on the church (home), scaled for portrait', () => {
    expect(overviewFor({ lat: 35.5, lng: -97.7 })).toEqual({ lat: 35.5, lng: -97.7, altitude: 2.35 })
    expect(overviewFor({ lat: 35.5, lng: -97.7 }, 2).altitude).toBeCloseTo(4.7)
  })
})
