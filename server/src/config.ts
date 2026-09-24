import { z } from 'zod'
import { parseNetworks } from './viewerAllowlist.js'

const bool = z
  .string()
  .optional()
  .transform((v) => v === '1' || v?.toLowerCase() === 'true')

const num = (def: number, min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).default(def)

const schema = z
  .object({
    MOCK_GATHERED: bool,
    GATHERED_BASE_URL: z.string().optional(),
    GATHERED_BOARD_TOKEN: z.string().optional(),
    GATHERED_FORWARDED_PROTO: z.enum(['https', 'http', 'none']).optional(),

    // Optional override; otherwise the church name comes from Gathered's branding.
    CHURCH_NAME: z.string().optional(),
    CHURCH_LAT: z.coerce.number().min(-90).max(90).default(35.5067),
    CHURCH_LNG: z.coerce.number().min(-180).max(180).default(-97.7625),

    VIEWER_ALLOWED_NETWORKS: z.string().optional(),
    TRUST_PROXY: z.string().optional(),

    POLL_SECONDS: num(120, 30, 3600),
    CLIENT_POLL_SECONDS: num(60, 15, 3600),
    IDLE_SECONDS: num(90, 15, 3600),
    SPOTLIGHT_SECONDS: num(12, 4, 600),
    LATEST_UPDATES_COUNT: num(12, 3, 100),

    PORT: num(8080, 1, 65535),
    HOST: z.string().default('0.0.0.0'),
    DATA_DIR: z.string().default('./data'),
    WEB_DIST: z.string().default('../web/dist'),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_GATHERED) {
      if (!env.GATHERED_BASE_URL || !URL.canParse(env.GATHERED_BASE_URL)) {
        ctx.addIssue({ code: 'custom', path: ['GATHERED_BASE_URL'], message: 'must be a URL, e.g. http://api:3000' })
      }
      if (!env.GATHERED_BOARD_TOKEN || !/^gathered_[0-9a-f]{64}$/.test(env.GATHERED_BOARD_TOKEN)) {
        ctx.addIssue({
          code: 'custom',
          path: ['GATHERED_BOARD_TOKEN'],
          message: 'must be a Gathered board token (gathered_ + 64 hex chars) from Settings → Integrations → Missionary Board',
        })
      }
    }
    // Required (no permissive default): the board page shows missionary data
    // to anyone who can load it, so the operator must say who that is.
    if (!env.VIEWER_ALLOWED_NETWORKS) {
      ctx.addIssue({
        code: 'custom',
        path: ['VIEWER_ALLOWED_NETWORKS'],
        message: 'required — comma-separated IPs/CIDRs allowed to view the board, e.g. the kiosk IP 192.168.10.45',
      })
    } else {
      const { errors } = parseNetworks(env.VIEWER_ALLOWED_NETWORKS)
      for (const message of errors) ctx.addIssue({ code: 'custom', path: ['VIEWER_ALLOWED_NETWORKS'], message })
    }
    if (env.TRUST_PROXY) {
      const { errors } = parseNetworks(env.TRUST_PROXY)
      for (const message of errors) ctx.addIssue({ code: 'custom', path: ['TRUST_PROXY'], message })
    }
  })

export type Config = ReturnType<typeof loadConfig>

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(env)
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`)
  }
  const e = result.data
  const baseUrl = e.MOCK_GATHERED ? 'http://mock.gathered' : e.GATHERED_BASE_URL!.replace(/\/+$/, '')
  // Gathered runs with force_ssl in production; an internal plain-http call
  // would be 301'd to https unless we say the original request was https.
  const forwardedProto =
    e.GATHERED_FORWARDED_PROTO === 'none'
      ? null
      : (e.GATHERED_FORWARDED_PROTO ?? (baseUrl.startsWith('http://') ? 'https' : null))

  return {
    mock: e.MOCK_GATHERED,
    gathered: {
      baseUrl,
      token: e.GATHERED_BOARD_TOKEN ?? '',
      forwardedProto,
    },
    church: { name: e.CHURCH_NAME, lat: e.CHURCH_LAT, lng: e.CHURCH_LNG },
    viewerNetworks: parseNetworks(e.VIEWER_ALLOWED_NETWORKS!).networks,
    trustProxy: e.TRUST_PROXY ? e.TRUST_PROXY.split(',').map((s) => s.trim()).filter(Boolean) : false,
    pollSeconds: e.POLL_SECONDS,
    clientPollSeconds: e.CLIENT_POLL_SECONDS,
    idleSeconds: e.IDLE_SECONDS,
    spotlightSeconds: e.SPOTLIGHT_SECONDS,
    latestUpdatesCount: e.LATEST_UPDATES_COUNT,
    port: e.PORT,
    host: e.HOST,
    dataDir: e.DATA_DIR,
    webDist: e.WEB_DIST,
  }
}
