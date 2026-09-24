import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadConfig } from '../src/config.js'
import type { GatheredBoardResponse, GatheredMissionary } from '../src/types.js'

export const TOKEN = `gathered_${'a'.repeat(64)}`

export async function tmpDir() {
  return mkdtemp(path.join(os.tmpdir(), 'mission-board-'))
}

export function testConfig(overrides: Record<string, string> = {}, dataDir = '/tmp/unused') {
  return loadConfig({
    GATHERED_BASE_URL: 'http://api:3000',
    GATHERED_BOARD_TOKEN: TOKEN,
    VIEWER_ALLOWED_NETWORKS: '192.168.10.0/24',
    DATA_DIR: dataDir,
    WEB_DIST: '/nonexistent',
    ...overrides,
  })
}

export const silentLog = { info() {}, warn() {}, error() {} }

export function missionary(m: Partial<GatheredMissionary> & { id: string; name: string }): GatheredMissionary {
  return {
    region: null, sensitive: false, ministry_focus: null, member_names: null, organization: null,
    country: null, latitude: null, longitude: null, bio: null, serving_since: null, website_url: null,
    photo_url: null, updates: [], ...m,
  }
}

export function board(missionaries: GatheredMissionary[]): GatheredBoardResponse {
  return { missionaries, generated_at: new Date().toISOString() }
}
