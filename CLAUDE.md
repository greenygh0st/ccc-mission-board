# Project rules — CCC Mission Board

Read `README.md` first. The data contract lives in the Gathered repo:
`ccc-gathered/docs/missionary-board-integration.md` and `API_DOCUMENTATION.md` →
"Missionaries & Missionary Board".

## Non-negotiable

- **Sensitive missionaries** (`sensitive: true`) are never placed on the globe, never get arcs,
  and are never enriched, geocoded or cross-referenced. `web/src/globe/geo.ts#placeMissionaries`
  enforces this, and `web/test/geo.test.ts` covers it. Keep both.
- **The Gathered token stays server-side.** It's only in `GatheredClient`, sent only in the
  `Authorization` header, and only to Gathered's host (never to S3/redirect targets).
- **User content is text.** Update bodies, bios and names render as React text, never
  `dangerouslySetInnerHTML`. Globe DOM markers use `textContent`.
- **No third-party requests from the page.** CSP is `default-src 'self'`. Bundle it or don't use it.
- **Don't log missionary content** (names, bodies, locations) on the server.
- **The viewer allowlist fails closed.** Don't add permissive defaults.

## Working here

- Add or update tests with every change; fix bugs with a regression test.
  - `npm test` runs server and web.
  - In web tests the globe is mocked, since jsdom has no WebGL.
- Keep `server/src/types.ts` and `web/src/types.ts` in sync.
- `MOCK_GATHERED=1` (`npm run dev:mock`) is the design sandbox. Its fixture includes sensitive,
  sparse and unplaced records on purpose.
- Keep `README.md` current.
