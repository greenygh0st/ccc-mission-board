import { existsSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'
import type { BoardStore } from './boardStore.js'
import type { Config } from './config.js'
import type { ImageCache, ImageSize } from './imageCache.js'
import { isAllowed } from './viewerAllowlist.js'

// Everything the kiosk needs is served from this origin — no third-party
// requests at all, which is both a security and an offline-resilience choice.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export function buildApp(config: Config, store: BoardStore, images: ImageCache, opts: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({
    logger: opts.logger ?? true,
    // Only trust X-Forwarded-For from the configured proxy; otherwise
    // request.ip is the direct TCP peer and a spoofed header is ignored.
    trustProxy: config.trustProxy,
  })

  app.addHook('onRequest', async (req, reply) => {
    reply.header('Content-Security-Policy', CSP)
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'no-referrer')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    // Docker HEALTHCHECK runs inside the container; it reveals no data.
    if (req.url === '/healthz') return
    if (!isAllowed(req.ip, config.viewerNetworks)) {
      req.log.warn({ ip: req.ip }, 'Denied viewer outside VIEWER_ALLOWED_NETWORKS')
      return reply.code(404).send({ error: 'Not found' })
    }
  })

  app.get('/healthz', async (req) => {
    const h = store.health()
    return {
      ok: h.ready,
      ...h,
      // Setup aid: the client IP as the board resolves it (after TRUST_PROXY).
      // Behind the reverse proxy this must be the device's real 192.168.x.x,
      // never the proxy's or the router's address.
      yourIp: req.ip,
      yourIpAllowed: isAllowed(req.ip, config.viewerNetworks),
    }
  })

  app.get('/api/board', async (_req, reply) => {
    const res = store.getResponse()
    reply.header('Cache-Control', 'no-store')
    if (!res) return reply.code(503).send({ error: 'not_ready' })
    return res
  })

  app.get<{ Params: { key: string; size: string } }>('/media/:key/:size', async (req, reply) => {
    const { key, size } = req.params
    if (!/^[0-9a-f]{40}$/.test(key) || (size !== 'thumb' && size !== 'full')) {
      return reply.code(404).send({ error: 'Not found' })
    }
    try {
      const buf = await images.get(key, size as ImageSize)
      if (!buf) return reply.code(404).send({ error: 'Not found' })
      reply.header('Content-Type', 'image/webp')
      reply.header('Cache-Control', 'private, max-age=86400')
      return reply.send(buf)
    } catch (err) {
      req.log.warn({ err: (err as Error).message }, 'Image unavailable')
      return reply.code(502).send({ error: 'image_unavailable' })
    }
  })

  const webRoot = path.resolve(config.webDist)
  if (existsSync(webRoot)) {
    app.register(fastifyStatic, { root: webRoot, wildcard: false })
    // SPA fallback
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/') && !req.url.startsWith('/media/')) {
        return reply.sendFile('index.html')
      }
      return reply.code(404).send({ error: 'Not found' })
    })
  } else {
    app.log.warn({ webRoot }, 'Web build not found — API only (run `npm run build -w web`)')
  }

  return app
}
