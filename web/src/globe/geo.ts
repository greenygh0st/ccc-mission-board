import { geoArea, geoCentroid } from 'd3-geo'
import type { Feature, Geometry, MultiPolygon, Polygon } from 'geojson'
import { polygonToCells } from 'h3-js'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json'
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import world from 'world-atlas/countries-110m.json'
import type { BoardMissionary } from '../types'

countries.registerLocale(en)

// Bundled Natural Earth 1:110m countries — the "pre-built map". No tile
// servers or network at all, so the globe renders even with the LAN down.
const topo = world as unknown as Topology<{ countries: GeometryCollection }>
export const landFeatures = (feature(topo, topo.objects.countries) as unknown as { features: Feature<Geometry, { name: string }>[] })
  .features

export const HEX_RESOLUTION = 3

// three-globe turns land into hex dots with H3, which throws (uncaught, from
// inside the render loop) on a few degenerate 110m shapes — e.g. North Korea.
// Screen every polygon once and drop the ones H3 can't handle, so a map-data
// quirk can never crash the kiosk. Only the dot layer uses this; centroids
// still use the full map.
export function hexSafeFeatures<T extends Feature<Geometry, { name: string }>>(features: T[], resolution = HEX_RESOLUTION): T[] {
  const out: T[] = []
  for (const f of features) {
    const g = f.geometry
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
    const ok = polys.filter((coords) => {
      try {
        polygonToCells(coords as number[][][], resolution, true)
        return true
      } catch {
        return false
      }
    })
    if (ok.length === polys.length) out.push(f)
    else if (ok.length > 0) out.push({ ...f, geometry: { type: 'MultiPolygon', coordinates: ok } as MultiPolygon })
  }
  return out
}

export const hexLandFeatures = hexSafeFeatures(landFeatures)

// Free-text country names staff might type that i18n-iso-countries doesn't know.
const ALIASES: Record<string, string> = {
  usa: 'US', 'u.s.': 'US', 'u.s.a.': 'US', america: 'US', 'united states': 'US',
  uk: 'GB', 'u.k.': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'great britain': 'GB',
  'south korea': 'KR', korea: 'KR', 'north korea': 'KP', russia: 'RU', 'ivory coast': 'CI',
  'czech republic': 'CZ', czechia: 'CZ', 'drc': 'CD', 'dr congo': 'CD', congo: 'CG', 'burma': 'MM',
  'east timor': 'TL', 'cape verde': 'CV', swaziland: 'SZ', eswatini: 'SZ', macedonia: 'MK',
  palestine: 'PS', 'the netherlands': 'NL', holland: 'NL', vietnam: 'VN', laos: 'LA', syria: 'SY',
  iran: 'IR', bolivia: 'BO', venezuela: 'VE', tanzania: 'TZ', moldova: 'MD', taiwan: 'TW',
}

/** ISO 3166-1 alpha-2 for a free-text country name, or null. */
export function countryCode(name: string | null | undefined): string | null {
  if (!name) return null
  const clean = name.trim()
  if (!clean) return null
  const alias = ALIASES[clean.toLowerCase()]
  if (alias) return alias
  if (/^[A-Za-z]{2}$/.test(clean) && countries.isValid(clean.toUpperCase())) return clean.toUpperCase()
  return countries.getAlpha2Code(clean, 'en') ?? null
}

// Centroid of each country's LARGEST polygon, keyed by ISO numeric id.
// (A whole-MultiPolygon centroid drifts into the ocean for countries with
// far-flung territories, e.g. France + French Guiana.)
const centroidByNumeric = new Map<string, [number, number]>()
for (const f of landFeatures) {
  if (f.id == null || !f.geometry) continue
  let geom: Polygon | MultiPolygon = f.geometry as Polygon | MultiPolygon
  if (geom.type === 'MultiPolygon') {
    const largest = geom.coordinates
      .map((coords) => ({ type: 'Polygon', coordinates: coords }) as Polygon)
      .sort((a, b) => geoArea(b) - geoArea(a))[0]
    geom = largest
  }
  const [lng, lat] = geoCentroid(geom)
  centroidByNumeric.set(String(f.id).padStart(3, '0'), [lat, lng])
}

/** [lat, lng] of a country's main landmass, or null if unknown/too small for the 110m map. */
export function countryCentroid(name: string | null | undefined): [number, number] | null {
  const alpha2 = countryCode(name)
  if (!alpha2) return null
  const numeric = countries.alpha2ToNumeric(alpha2)
  return numeric ? (centroidByNumeric.get(numeric.padStart(3, '0')) ?? null) : null
}

export interface PlacedMissionary {
  missionary: BoardMissionary
  lat: number
  lng: number
  /** true when placed at a country centroid rather than exact coordinates */
  approximate: boolean
}

/**
 * Decides who goes on the globe and where.
 *
 * NON-NEGOTIABLE: sensitive missionaries are never placed — not from
 * coordinates, not from a country, not from a region guess. (Gathered already
 * nulls their location; this is the second line of defence.)
 */
export function placeMissionaries(list: BoardMissionary[]): { placed: PlacedMissionary[]; unplaced: BoardMissionary[] } {
  const placed: PlacedMissionary[] = []
  const unplaced: BoardMissionary[] = []

  for (const m of list) {
    if (m.sensitive) {
      unplaced.push(m)
      continue
    }
    if (isFiniteCoord(m.latitude, 90) && isFiniteCoord(m.longitude, 180)) {
      placed.push({ missionary: m, lat: m.latitude!, lng: m.longitude!, approximate: false })
      continue
    }
    const c = countryCentroid(m.country)
    if (c) placed.push({ missionary: m, lat: c[0], lng: c[1], approximate: true })
    else unplaced.push(m)
  }

  return { placed: spreadOverlaps(placed), unplaced }
}

function isFiniteCoord(v: number | null, max: number) {
  return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= max
}

// Missionaries at (nearly) the same spot are fanned out on a small circle so
// each dot can be tapped. Deterministic (input order), so dots don't jump.
const OVERLAP_DEG = 0.75
function spreadOverlaps(points: PlacedMissionary[]): PlacedMissionary[] {
  const groups: PlacedMissionary[][] = []
  for (const p of points) {
    const g = groups.find((grp) => Math.abs(grp[0].lat - p.lat) < OVERLAP_DEG && Math.abs(grp[0].lng - p.lng) < OVERLAP_DEG)
    if (g) g.push(p)
    else groups.push([p])
  }
  return groups.flatMap((g) => {
    if (g.length === 1) return g
    const r = 1.1 + g.length * 0.12
    return g.map((p, i) => {
      const a = (2 * Math.PI * i) / g.length
      return { ...p, lat: g[0].lat + r * Math.sin(a), lng: g[0].lng + (r * Math.cos(a)) / Math.max(Math.cos((g[0].lat * Math.PI) / 180), 0.3) }
    })
  })
}

/** Great-circle distance in degrees. */
export function angularDistance(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLng = (bLng - aLng) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / toRad
}
