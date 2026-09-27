# CCC Mission Board

An interactive, touch-first missionary board for the church lobby: a 3D globe
with a glowing light for each missionary we support, arcs from home, and the
latest news from the field. Built to run 24/7 on a large landscape
touchscreen in Chromium kiosk mode, and to adapt to portrait and smaller screens.

All data comes from **Gathered** (the church management system), where staff
manage missionaries and missionaries post updates for approval. This app only
**reads**. The Gathered-side contract and rules are in
`ccc-gathered/docs/missionary-board-integration.md`.

## What it does

- **Globe**
  - A three.js globe (`react-globe.gl`) drawn with the bundled Natural Earth map, so there are
    no tile servers or internet.
  - Missionaries appear as glowing points, with pulsing rings for news in the last 30 days.
  - Animated arcs run from the church to each missionary.
  - Drag to spin, pinch to zoom, tap a light (taps up to ~56px off still count).
  - Missionaries without coordinates are placed at their country's centre.
  - It starts **centred on the church** and slowly spins east–west while nothing is selected.
  - If someone drags it and lets go, it flies back to Home after 10 seconds and spins again.
  - With a missionary selected it stays on them, including after a drag.
  - The rules live in `web/src/globe/spinController.ts`.
- **Left rail**
  - Shows the **latest 3 updates** from everyone.
  - Tap a card or a light and it becomes that missionary's page: photo, family, ministry, bio,
    **their latest 3 updates**, a fullscreen swipeable photo viewer, and a QR code for their
    website. Links can't be opened on a kiosk.
- **Bottom strip:** everyone, grouped by region, so nobody has to be hunted for on the globe.
- **Sensitive missionaries**
  - They are **never** placed on the globe and have no arcs.
  - They appear in the strip under "Serving in sensitive locations" with their alias, broad
    region and approved updates.
- **Attract mode**
  - After `IDLE_SECONDS` without a touch, the board resets, the globe rotates, and it cycles
    through missionaries with the newest news.
  - Any touch brings it back.
- **Visitors off the church network** see a plain "This page isn't available here" page, which
  reveals nothing about the board. API and media requests still get a bare JSON 404.
- **Kiosk hardening**
  - No zoom, text selection, context menu or navigation.
  - The cursor stays hidden, crashes recover on their own, and the page reloads nightly at 3am.
- **Church logo:** the square logo from Gathered's branding is shown as a circle in the corner.
  A wide wordmark is only used, uncropped, when there's no logo.
- **Resilience**
  - The server keeps the last good data on disk.
  - If Gathered is down or the token is revoked, the wall keeps showing cached data, with a small
    "Updated … ago" indicator.

## Architecture

```
Kiosk Chromium ──► board container (Fastify)          ──(Bearer token)──► Gathered
                     /            built SPA                                 /api/v1/board/missionaries
                     /api/board   cached, re-shaped feed                   /api/v1/public/branding
                     /media/…     resized WebP photo cache
                     /healthz     last Gathered fetch status
```

- **The token never reaches the browser.** The server polls Gathered every `POLL_SECONDS`, and
  the kiosk polls the server.
- **Photos** are fetched server-side, resized with `sharp` to 400px thumbnails and 1600px
  WebP, and cached in `/data`. The browser never sees Gathered's URLs, which may point at an
  internal hostname.
- **External requests:** the page makes none. Fonts, map data and QR codes are all bundled or
  generated locally, and the CSP is `default-src 'self'`.

```
server/  Fastify API, Gathered client, poller, image cache, viewer allowlist (Vitest)
web/     React 19 + Vite + Tailwind v4 + react-globe.gl + framer-motion (Vitest + Testing Library)
```

## Configuration (environment variables)

| Var | Required | Notes |
|---|---|---|
| `GATHERED_BASE_URL` | ✓ | `https://gathered.cccyukon.org` (via Cloudflare, so Gathered sees the church WAN IP) |
| `GATHERED_BOARD_TOKEN` | ✓ | From Gathered → Settings → Integrations → Missionary Board. Header-only, server-side only |
| `VIEWER_ALLOWED_NETWORKS` | ✓ | IPs/CIDRs allowed to **open the board**, i.e. the church WAN IP `12.189.82.18`. Everyone else gets 404. No permissive default |
| `TRUST_PROXY` | ✓ behind a proxy | The reverse proxy's container IP. `X-Forwarded-For` is believed only from it |
| `TRUST_CLOUDFLARE` | ✓ via Cloudflare | `1` to also step past Cloudflare's edge ranges (`server/src/cloudflare.ts`) to the real viewer |
| `CHURCH_LAT` / `CHURCH_LNG` | | Home point for the arcs (default Yukon, OK) |
| `CHURCH_NAME` | | Overrides the name from Gathered's branding |
| `GATHERED_IP_FAMILY` | | `4` (default), `6` or `auto`. Gathered allowlists by address, and a dual-stack host has a different IPv6 one, so the board sticks to IPv4 unless told otherwise |
| `GATHERED_FORWARDED_PROTO` | | Defaults to `https` for `http://` base URLs so Gathered's `force_ssl` doesn't redirect internal calls; `none` disables it |
| `POLL_SECONDS` (120), `CLIENT_POLL_SECONDS` (60), `IDLE_SECONDS` (90), `SPOTLIGHT_SECONDS` (12) | | Tuning |
| `PORT` (8080), `DATA_DIR` (`./data`), `MOCK_GATHERED` | | `MOCK_GATHERED=1` serves a fictional fixture (dev only) |

The server validates everything at boot and exits with a clear message if something is missing.

## Deploying (church topology)

Everything goes out through the church's WAN and back in via Cloudflare:

```
kiosk ──► Cloudflare ──► church WAN 12.189.82.18 ──► proxy manager ──► board container
board container ──► Cloudflare ──► church WAN ──► proxy manager ──► Gathered
```

Don't use a local DNS override. Internal 80/443 goes straight to the application box and skips
the proxy manager.

**1. Board → Gathered.**
- Set `GATHERED_BASE_URL=https://gathered.cccyukon.org`. Gathered sees the church's external IP
  like every other device in the building.
- In Gathered → Settings → Integrations → Missionary Board, **allow `12.189.82.18`** and create the
  board token.
- This needs Gathered's Cloudflare fix (`trusted_proxies.rb`, 2026-09-26). Before it, Gathered saw
  a random Cloudflare edge instead of the church IP.
- `12.189.82.18` means "anything leaving the church", including guest Wi-Fi and VPN users. The
  token is the second factor.

**2. Kiosk → board.** Add a proxy host for the board (e.g. `board.cccyukon.org`, proxied through
Cloudflare) and set:
- `VIEWER_ALLOWED_NETWORKS=12.189.82.18`. The board only opens for devices leaving the church.
- `TRUST_PROXY=<proxy manager's container IP>` and `TRUST_CLOUDFLARE=1`, so the board steps past
  the proxy manager and Cloudflare's edge to the real viewer. Without them every viewer looks like
  the proxy or an edge and gets a 404. That fails closed.
- Optionally, add a proxy-manager access list or a Cloudflare rule allowing only `12.189.82.18`,
  as defense in depth.
- Don't publish host ports on the container.

**Check it:**
- **From inside the church:** `https://<board-host>/healthz` shows `yourIp: 12.189.82.18`,
  `yourIpAllowed: true`, and `stale: false` once Gathered answers.
- **From a phone on cellular:** the board is refused.
- **`yourIp` looks like a Cloudflare address** (`172.64–71.x`, `104.16–31.x`, `162.158–159.x`):
  `TRUST_CLOUDFLARE` is off, or Cloudflare added a range. Update `server/src/cloudflare.ts`.
- **`lastErrorStatus: 404`:** Gathered's allowlist or token is wrong.

**Kiosk browser:** Chromium with `--kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 https://<board-host>`.

## CI and the Docker image

`.github/workflows/ci.yml` runs on every pull request and push:

1. **test:** `npm ci`, typecheck, server and web tests, production build (Node 22).
2. **docker:** builds the image and smoke-tests it in mock mode: `/healthz` is ok, the feed has
   missionaries, a photo comes back as WebP, and the page is served.
   - On **push to `main`** it also pushes `<dockerhub-user>/ccc-mission-board:<commit sha>` and
     `:latest` to Docker Hub.
   - On a **`v1.2.3` tag** it also pushes `:1.2.3`.
   - Pull requests never push.

It needs the repo secrets `DOCKER_HUB_USERNAME` and `DOCKER_HUB_ACCESS_TOKEN`, the same ones
`ccc-gathered` uses. The image is `linux/amd64`, and runs as the non-root `node` user with
`/data` as a volume.

To build and smoke-test locally:

```bash
docker build -t ccc-mission-board:local .
docker run --rm -p 8080:8080 -e MOCK_GATHERED=1 -e VIEWER_ALLOWED_NETWORKS=0.0.0.0/0 ccc-mission-board:local
```

## Development

Needs Node 22 or newer.

```bash
npm install
npm run dev:mock      # fictional data, no Gathered needed → http://localhost:5180
npm test              # server + web
npm run typecheck
npm run build
```

Against a local Gathered, create `.env` from `.env.example` and run `npm run dev`. In local dev,
Gathered sees Docker's gateway IP. Its settings page refuses to allowlist that on purpose, so set
it with `rails runner`, as described in the Gathered handoff doc, section 7.

> Tool versions are pinned to Vite 6, Vitest 3 and jsdom 26 so they run on Node 22.11. Vite 8,
> Rolldown and jsdom 30 need ≥ 22.12. The Docker image always uses the latest Node 22.
