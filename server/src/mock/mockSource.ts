import sharp from 'sharp'
import type { BoardSource } from '../boardStore.js'
import type { GatheredBoardResponse, GatheredBranding, GatheredMissionary, GatheredUpdate } from '../types.js'

// Dev-only stand-in for Gathered (MOCK_GATHERED=1). All people are fictional.
// Deliberately includes the awkward cases the real feed produces: sensitive
// (already redacted exactly as Gathered does), country-only (no coordinates),
// fully unplaced, no photo, no updates, and many updates.

const daysAgo = (d: number, h = 9) => new Date(Date.now() - d * 86_400_000 - h * 3_600_000).toISOString()

let updateSeq = 0
const update = (days: number, title: string | null, body: string, images: string[] = []): GatheredUpdate => ({
  id: `mock-update-${++updateSeq}`,
  title,
  body,
  published_at: daysAgo(days),
  image_urls: images,
})

const base = (m: Partial<GatheredMissionary> & Pick<GatheredMissionary, 'id' | 'name'>): GatheredMissionary => ({
  region: null,
  sensitive: false,
  ministry_focus: null,
  member_names: null,
  organization: null,
  country: null,
  latitude: null,
  longitude: null,
  bio: null,
  serving_since: null,
  website_url: null,
  photo_url: null,
  updates: [],
  ...m,
})

function buildMissionaries(): GatheredMissionary[] {
  updateSeq = 0
  return [
    base({
      id: 'mock-1', name: 'The Okafor Family', region: 'East Africa', country: 'Kenya',
      latitude: -1.2921, longitude: 36.8219, organization: 'Horizon Mission', ministry_focus: 'Church planting',
      member_names: 'Daniel, Grace, Ada & Tobi', serving_since: '2016-08-01',
      bio: 'Daniel and Grace train local pastors across the Rift Valley and run a weekly discipleship school for new believers.',
      website_url: 'https://example.org/okafor', photo_url: 'mock://portrait/1',
      updates: [
        update(1, 'School opening', 'The new school building opened this week!\n\n84 children showed up on day one. Please pray for the teachers as term begins.', ['mock://scene/1', 'mock://scene/2']),
        update(24, 'Rainy season', 'Roads are washed out between villages, so our visits are slower. Pray for safe travel.'),
      ],
    }),
    base({
      id: 'mock-2', name: 'The Lindqvist Family', region: 'South America', country: 'Peru',
      latitude: -13.5319, longitude: -71.9675, organization: 'Word Translation Alliance', ministry_focus: 'Bible translation',
      member_names: 'Erik & Maria', serving_since: '2011-03-15',
      bio: 'Translating the New Testament into Quechua with a team of local translators in the Andes.',
      photo_url: 'mock://portrait/2',
      updates: [
        update(3, 'Gospel of Luke complete', 'After six years the Gospel of Luke is checked and ready for printing. Thank you for praying with us through every chapter.', ['mock://scene/3']),
      ],
    }),
    base({
      id: 'mock-3', name: 'Pastor Samuel Reyes', region: 'Central America', country: 'Guatemala',
      latitude: 14.6349, longitude: -90.5069, organization: 'Local church partner', ministry_focus: 'Youth ministry',
      serving_since: '2019-01-10', photo_url: 'mock://portrait/3',
      bio: 'Samuel leads a youth center offering tutoring, soccer and Bible study in Guatemala City.',
      updates: [update(6, null, 'Our soccer camp had 120 kids this summer. Twelve asked to join the Bible study afterwards!', ['mock://scene/4'])],
    }),
    base({
      id: 'mock-4', name: 'The Brandt Family', region: 'Europe', country: 'Germany',
      organization: 'Harbor Missions', ministry_focus: 'Refugee outreach', member_names: 'Jonas, Lea, Mila',
      serving_since: '2021-09-01', photo_url: 'mock://portrait/4',
      bio: 'Serving refugee families in Berlin with language classes, meals and friendship.',
      updates: [update(12, 'Language café', 'Our Tuesday language café is now full every week — we are looking for more volunteers.')],
    }),
    base({
      id: 'mock-5', name: 'Dr. Hannah Mercer', region: 'West Africa', country: 'Ghana',
      latitude: 5.6037, longitude: -0.187, organization: 'Healing Hands Medical', ministry_focus: 'Medical missions',
      serving_since: '2014-06-01', photo_url: 'mock://portrait/5',
      bio: 'Hannah is a family physician running a rural clinic and training community health workers.',
      updates: [
        update(9, 'New clinic wing', 'The maternity wing is finished! We delivered our first baby there on Saturday.', ['mock://scene/5']),
        update(40, 'Prayer request', 'Please pray for a steady supply of medicines through the dry season.'),
      ],
    }),
    base({
      id: 'mock-6', name: 'The Tanaka Family', region: 'East Asia', country: 'Japan',
      latitude: 35.6762, longitude: 139.6503, organization: 'Pacific Campus Fellowship', ministry_focus: 'Campus ministry',
      member_names: 'Kenji, Aiko & Ren', serving_since: '2018-04-01', photo_url: 'mock://portrait/6',
      bio: 'Reaching university students in Tokyo through English conversation groups and hospitality.',
      updates: [update(15, 'Spring semester', 'Twenty new students joined our conversation groups this spring.')],
    }),
    base({
      id: 'mock-7', name: 'The Whitfield Family', region: 'Oceania', country: 'Papua New Guinea',
      latitude: -6.3149, longitude: 143.9555, organization: 'Skyward Aviation Ministry', ministry_focus: 'Aviation',
      member_names: 'Tom, Sarah, Eli & June', serving_since: '2012-02-01', photo_url: 'mock://portrait/7',
      bio: 'Tom flies supplies, medical evacuations and Bible translators into remote highland airstrips.',
    }),
    base({
      id: 'mock-8', name: 'The Novak Family', region: 'Europe', country: 'Czechia',
      latitude: 50.0755, longitude: 14.4378, organization: 'Next Gen Europe', ministry_focus: 'Youth discipleship',
      member_names: 'Petr & Anna', serving_since: '2020-07-01',
      bio: 'Equipping young leaders to reach their friends through camps and English clubs.',
      updates: [update(30, 'Summer camps', 'Five camps, 400 students, and many first-time conversations about faith.')],
    }),
    base({
      id: 'mock-9', name: 'The Haddad Family', region: 'North Africa', country: 'Morocco',
      organization: 'Crossroads Partners', ministry_focus: 'Business as mission', serving_since: '2017-10-01',
      photo_url: 'mock://portrait/9',
      bio: 'Running a small café and training center that employs and mentors local young adults.',
    }),
    base({
      id: 'mock-10', name: 'The Carter Family', region: 'Caribbean', country: 'Haiti',
      latitude: 18.5944, longitude: -72.3074, organization: 'Hope Academy Network', ministry_focus: 'Education',
      member_names: 'Marcus & Tasha', serving_since: '2015-01-01', photo_url: 'mock://portrait/10',
      bio: 'Marcus and Tasha oversee a K–12 school serving 600 students.',
      updates: [
        update(2, 'Graduation', 'Our largest graduating class yet — 48 seniors!', ['mock://scene/6', 'mock://scene/7', 'mock://scene/8']),
        update(20, null, 'Thank you for the school supply drive. Every classroom is stocked for the year.'),
        update(55, 'Hurricane season', 'We are preparing shelters and supplies. Pray for protection.'),
      ],
    }),
    base({
      id: 'mock-11', name: 'Ruth Abernathy', region: 'South Asia', country: 'Nepal',
      latitude: 27.7172, longitude: 85.324, organization: 'Summit Health Fellowship', ministry_focus: 'Community health',
      serving_since: '2009-05-01',
      bio: 'Ruth trains village health volunteers in maternal and child health in the Himalayan foothills.',
      updates: [update(45, 'Trek season', 'Heading out for a three-week training trek to remote villages.')],
    }),
    base({ id: 'mock-12', name: 'The Morales Family', region: 'Home office', organization: 'Mission support', ministry_focus: 'Member care' }),
    // Sensitive: exactly the redacted shape Gathered returns.
    base({
      id: 'mock-13', name: 'The S. Family', region: 'Asia', sensitive: true,
      updates: [update(4, 'Praise report', 'Three new believers were baptized this month. Please keep praying for wisdom and protection.')],
    }),
    base({ id: 'mock-14', name: 'The K. Family', region: 'Middle East', sensitive: true }),
  ]
}

export class MockSource implements BoardSource {
  constructor(private readonly churchName?: string) {}

  async fetchBoard(): Promise<GatheredBoardResponse> {
    return { missionaries: buildMissionaries(), generated_at: new Date().toISOString() }
  }

  async fetchBranding(): Promise<GatheredBranding> {
    return {
      church_name: this.churchName ?? 'Our Church',
      church_logo_url: 'mock://logo/1',
      church_wordmark_url: null,
      primary_color: '#133A49',
      accent_color: '#BD7142',
    }
  }
}

// ── Generated placeholder images (no external assets) ────────────────────────

const PALETTES = [
  ['#1f4e5f', '#e0a96d'], ['#3b2c4a', '#f2c38f'], ['#20443a', '#d9b26f'], ['#4a2f2a', '#f0b27a'],
  ['#1d3557', '#a8dadc'], ['#3d405b', '#f2cc8f'], ['#264653', '#e9c46a'], ['#582f0e', '#ffd6a5'],
]

function portraitSvg(n: number) {
  const [bg, fg] = PALETTES[n % PALETTES.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
    <defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${fg}" stop-opacity=".55"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs>
    <rect width="800" height="800" fill="url(#g)"/>
    <circle cx="400" cy="320" r="140" fill="${fg}" opacity=".9"/>
    <ellipse cx="400" cy="720" rx="260" ry="220" fill="${fg}" opacity=".9"/>
  </svg>`
}

function sceneSvg(n: number) {
  const [bg, fg] = PALETTES[(n * 3) % PALETTES.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
    <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fg}"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs>
    <rect width="1600" height="1000" fill="url(#s)"/>
    <circle cx="${400 + n * 120}" cy="330" r="110" fill="#fff6e0" opacity=".85"/>
    <path d="M0 760 L380 420 L700 700 L1000 380 L1600 800 L1600 1000 L0 1000 Z" fill="${bg}" opacity=".85"/>
    <path d="M0 880 L500 640 L900 860 L1300 620 L1600 820 L1600 1000 L0 1000 Z" fill="#0b1a20" opacity=".55"/>
  </svg>`
}

// A square placeholder church logo (real logos are square too), so the
// circular logo treatment gets exercised in the sandbox.
function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="#f6efe4"/>
    <circle cx="256" cy="256" r="150" fill="none" stroke="#133a49" stroke-width="44"/>
    <path d="M256 150 V362 M190 222 H322" stroke="#bd7142" stroke-width="40" stroke-linecap="round"/>
  </svg>`
}

export async function renderMockImage(url: string): Promise<Buffer> {
  const m = /^mock:\/\/(portrait|scene|logo)\/(\d+)$/.exec(url)
  if (!m) throw new Error(`Unknown mock image ${url}`)
  const svg = m[1] === 'portrait' ? portraitSvg(Number(m[2])) : m[1] === 'logo' ? logoSvg() : sceneSvg(Number(m[2]))
  return sharp(Buffer.from(svg)).png().toBuffer()
}
