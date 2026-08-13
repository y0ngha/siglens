---
name: project-cdn-cache-rsc-guard-dead-code
description: perf/cdn-cache-hit-rate — origin-side `_rsc` guard in proxy.ts was dead code; adapter.js strips both signals before middleware runs
metadata:
  type: project
---

Round 1-2 of `perf/cdn-cache-hit-rate` approved a `src/proxy.ts` guard that 307-redirected requests
with `?_rsc=` but no `RSC` header, intended as a second line of defense alongside the Cloudflare R1
cache rule's `_rsc=` exclusion. Round 3 runtime verification (local production build) found the guard
was **unreachable**: `next/dist/server/web/adapter.js` calls `stripInternalSearchParams(normalizeURL)`
(strips `_rsc` from the URL) and deletes `FLIGHT_HEADERS` (including `RSC`) from the request headers
before constructing the `NextRequest` passed to middleware. Confirmed empirically: `GET /aapl?_rsc=probe`
→ 301 `Location: /AAPL` with no `_rsc` in the Location, proving the param was already stripped pre-middleware.

Fix: reverted `src/proxy.ts` and its test to master exactly; corrected `docs/architecture/CDN_CACHING.md`
§3 to state the invariant can only be enforced at the edge (Cloudflare R1's `_rsc=` exclusion is the
*sole* defense); updated `scripts/probe-cdn-cache.sh`'s probe row from expecting `status=307` to expecting
`cf-cache-status: DYNAMIC/DYNAMIC` on `/AAPL?_rsc=probe1` without the RSC header.

**Why:** Next.js middleware in this version cannot see `_rsc` query params or the `RSC` header at all —
any future origin-side guard keyed on either signal will silently never fire. This is a Next-internal
behavior (not proxy.ts-specific), so the same trap applies to any future middleware logic that tries to
special-case RSC/prefetch requests.

**How to apply:** When reviewing `src/proxy.ts` (or any middleware) changes that branch on `_rsc` query
params or Next's internal `RSC`/`Next-Router-*` headers, flag it — request evidence from a local
production build (`yarn build && yarn start`, not `next dev`) that the branch actually fires, since
`next dev` doesn't reproduce the same adapter stripping timing as reliably. Cache-key invariants that
depend on distinguishing RSC vs HTML requests belong at the CDN/edge layer in this codebase, not in
`proxy.ts`.

**Round 3 addendum (2026-08-13, same PR):** New scope in this PR fixed OG/Twitter image 0% cache
hit ratio — `next/og`'s `ImageResponse` hardcodes `cache-control: public, max-age=0,
must-revalidate` (`next/dist/server/og/image-response.js`), unrelated to the route's `revalidate`
export. Fixed via `options.headers` override (`OG_IMAGE_CACHE_CONTROL` in `src/shared/lib/og.ts`,
threaded through `buildSymbolOgImage`'s optional `cacheControl` param). Verified all 23
opengraph-image/twitter-image files route through either `buildSymbolOgImage` or a direct
`ImageResponse` header; twitter-image files are `export { default } from './opengraph-image'`
re-exports, so they inherit the same response/header — no separate header needed there.
`/share/[id]/opengraph-image.tsx` intentionally keeps the original must-revalidate header (content
flips on share expiry) — both call sites (found/expired branches) pass the override, confirmed.
