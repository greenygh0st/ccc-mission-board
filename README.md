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
- **Kiosk hardening**
  - No zoom, text selection, context menu or navigation.
  - The cursor stays hidden, crashes recover on their own, and the page reloads nightly at 3am.
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
| `GATHERED_BASE_URL` | ✓ | e.g. `http://api:3000` (internal Docker network) or the public https URL |
| `GATHERED_BOARD_TOKEN` | ✓ | From Gathered → Settings → Integrations → Missionary Board. Header-only, server-side only |
| `VIEWER_ALLOWED_NETWORKS` | ✓ | IPs/CIDRs allowed to **open the board**, i.e. the church network `192.168.0.0/22`. Everyone else gets 404. No permissive default |
| `TRUST_PROXY` | ✓ behind a proxy | The reverse proxy's container IP. `X-Forwarded-For` is believed only from it |
| `CHURCH_LAT` / `CHURCH_LNG` | | Home point for the arcs (default Yukon, OK) |
| `CHURCH_NAME` | | Overrides the name from Gathered's branding |
| `GATHERED_FORWARDED_PROTO` | | Defaults to `https` for `http://` base URLs so Gathered's `force_ssl` doesn't redirect internal calls; `none` disables it |
| `POLL_SECONDS` (120), `CLIENT_POLL_SECONDS` (60), `IDLE_SECONDS` (90), `SPOTLIGHT_SECONDS` (12) | | Tuning |
| `PORT` (8080), `DATA_DIR` (`./data`), `MOCK_GATHERED` | | `MOCK_GATHERED=1` serves a fictional fixture (dev only) |

The server validates everything at boot and exits with a clear message if something is missing.

## Deploying next to Gathered (behind the reverse proxy)

See `docker-compose.example.yml`. There are two separate network concerns.

**1. Board → Gathered.** Gathered's feed only answers allowlisted IPs.
- Give this container a **fixed IP** on a small network shared with Gathered's `api` container.
  Docker needs a configured subnet for that:
  `docker network create --subnet 172.30.60.0/24 gathered-board`.
- Call `http://api:3000` directly, not through the proxy.
- In Gathered → Settings → Integrations → Missionary Board, allow exactly that IP (e.g.
  `172.30.60.10`) and create the board token.

**2. Kiosk → board.** The board page shows missionary data without a token, so the church
network is filtered twice:
- **Reverse proxy:** add a proxy host for the board with an **access list that allows
  `192.168.0.0/22` and denies everything else**. Don't publish any host ports on the container.
- **Board:** `VIEWER_ALLOWED_NETWORKS=192.168.0.0/22` and `TRUST_PROXY=<proxy's container IP>`.
  - The board only believes `X-Forwarded-For` from that address.
  - If `TRUST_PROXY` is missing or wrong, every viewer looks like the proxy and gets a 404. That
    fails closed.

**The check that matters (do this before trusting it):**
- **From a device on the church network,** open `https://<board-host>/healthz`. `yourIp` must be
  that device's real `192.168.x.x` address, with `yourIpAllowed: true`.
- **From a phone on cellular data** (Wi-Fi off), the board URL must be refused by the proxy.
- **If `yourIp` is the router's address** (e.g. `192.168.0.1`) or a Docker address for *every*
  device, the proxy isn't seeing real client IPs. Hairpin NAT or Docker's userland proxy can do
  this. Then traffic from the internet could look like it's inside `192.168.0.0/22` too. Fix
  that before going live, for example by reaching the board via internal DNS rather than the
  public hostname.

**Health:**
- `/healthz` shows `stale:false` and the missionary count once Gathered answers.
- `lastErrorStatus: 404` means the token or IP allowlist is wrong on the Gathered side.

**Kiosk browser:** Chromium with `--kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 https://<board-host>`.

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
