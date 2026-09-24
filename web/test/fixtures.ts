import type { BoardMissionary, BoardResponse, BoardUpdate } from '../src/types'

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString()

export function upd(id: string, missionaryId: string, daysAgo: number, extra: Partial<BoardUpdate> = {}): BoardUpdate {
  return { id, missionaryId, title: `Title ${id}`, body: `Body ${id}`, publishedAt: iso(daysAgo), images: [], ...extra }
}

export function mis(id: string, extra: Partial<BoardMissionary> = {}): BoardMissionary {
  return {
    id, name: `Missionary ${id}`, region: null, sensitive: false, ministryFocus: null, memberNames: null,
    organization: null, country: null, latitude: null, longitude: null, bio: null, servingSince: null,
    websiteUrl: null, photo: null, updates: [], ...extra,
  }
}

export function boardFixture(): BoardResponse {
  const a = mis('a', {
    name: 'The Okafor Family', region: 'East Africa', country: 'Kenya', latitude: -1.29, longitude: 36.82,
    websiteUrl: 'https://example.org/okafor',
    updates: [upd('a1', 'a', 1), upd('a2', 'a', 10), upd('a3', 'a', 20), upd('a4', 'a', 40)],
  })
  const b = mis('b', { name: 'The Lindqvist Family', region: 'South America', country: 'Peru', updates: [upd('b1', 'b', 2)] })
  const c = mis('c', { name: 'Ruth Abernathy', region: 'South Asia', country: 'Nepal', updates: [upd('c1', 'c', 5)] })
  const s = mis('s', { name: 'The S. Family', region: 'Asia', sensitive: true, updates: [upd('s1', 's', 3)] })
  const missionaries = [a, b, c, s]
  const latestUpdates = missionaries.flatMap((m) => m.updates).sort((x, y) => Date.parse(y.publishedAt!) - Date.parse(x.publishedAt!))
  return {
    missionaries,
    latestUpdates,
    church: { name: 'Test Church', lat: 35.5, lng: -97.7, logo: null, wordmark: null, primaryColor: '#133A49', accentColor: '#BD7142' },
    settings: { idleSeconds: 60, spotlightSeconds: 10, clientPollSeconds: 60 },
    fetchedAt: new Date().toISOString(),
    stale: false,
  }
}
