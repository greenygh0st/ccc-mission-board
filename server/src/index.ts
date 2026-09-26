import path from 'node:path'
import { buildApp } from './app.js'
import { BoardStore } from './boardStore.js'
import { loadConfig } from './config.js'
import { GatheredClient } from './gatheredClient.js'
import { ImageCache } from './imageCache.js'
import { MockSource, renderMockImage } from './mock/mockSource.js'

let config
try {
  config = loadConfig()
} catch (err) {
  console.error((err as Error).message)
  process.exit(1)
}

const client = new GatheredClient({
  baseUrl: config.gathered.baseUrl,
  token: config.gathered.token,
  forwardedProto: config.gathered.forwardedProto,
  ipFamily: config.gathered.ipFamily,
})
const source = config.mock ? new MockSource(config.church.name) : client
const images = new ImageCache(
  path.join(config.dataDir, 'images'),
  config.mock ? renderMockImage : (url) => client.fetchImage(url),
)

const store = new BoardStore(config, source, images, console)
const app = buildApp(config, store, images)
store.setLogger(app.log) // structured logs once Fastify's logger exists

if (config.mock) app.log.warn('MOCK_GATHERED=1 — serving fictional fixture data, not Gathered')

await store.loadFromDisk()
store.start()

const shutdown = async () => {
  store.stop()
  await app.close()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

await app.listen({ port: config.port, host: config.host })
