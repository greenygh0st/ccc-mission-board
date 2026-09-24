// Browser-side copy of server/src/types.ts — keep in sync.
// Only the Board* shapes are used here; Gathered* shapes never reach the browser.

export interface GatheredUpdate {
  id: string
  title: string | null
  body: string
  published_at: string | null
  image_urls: string[]
}

export interface GatheredMissionary {
  id: string
  name: string
  region: string | null
  sensitive: boolean
  ministry_focus: string | null
  member_names: string | null
  organization: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  bio: string | null
  serving_since: string | null
  website_url: string | null
  photo_url: string | null
  updates: GatheredUpdate[]
}

export interface GatheredBoardResponse {
  missionaries: GatheredMissionary[]
  generated_at: string
}

export interface GatheredBranding {
  church_name: string | null
  church_logo_url: string | null
  church_wordmark_url: string | null
  primary_color: string | null
  accent_color: string | null
  timezone?: string | null
}

// ── What the browser receives ────────────────────────────────────────────────

export interface BoardImage {
  /** 400px-wide WebP, for cards/avatars */
  thumb: string
  /** up to 1600px WebP, for the detail hero and lightbox */
  full: string
}

export interface BoardUpdate {
  id: string
  missionaryId: string
  title: string | null
  body: string
  publishedAt: string | null
  images: BoardImage[]
}

export interface BoardMissionary {
  id: string
  name: string
  region: string | null
  sensitive: boolean
  ministryFocus: string | null
  memberNames: string | null
  organization: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  bio: string | null
  servingSince: string | null
  websiteUrl: string | null
  photo: BoardImage | null
  updates: BoardUpdate[]
}

export interface BoardResponse {
  missionaries: BoardMissionary[]
  /** Newest approved updates across all missionaries (newest first). */
  latestUpdates: BoardUpdate[]
  church: {
    name: string
    lat: number
    lng: number
    logo: BoardImage | null
    wordmark: BoardImage | null
    primaryColor: string
    accentColor: string
  }
  settings: {
    idleSeconds: number
    spotlightSeconds: number
    clientPollSeconds: number
  }
  /** When Gathered last answered successfully. */
  fetchedAt: string
  /** True when the most recent fetch failed and this is cached data. */
  stale: boolean
}
