---
name: seo-internal-links-relatedsymbols-r5
description: RelatedSymbols.tsx round 5 (post-approval async server component add) — DSU-swallow required finding, Suspense-shell recommended
metadata:
  type: project
---

R5 reviewed the async-server-component conversion of `src/views/symbol/RelatedSymbols.tsx`
(resolves peer Korean names via `getAssetInfoResilient`, DB name overrides curated).

## Required finding (verified live, not theoretical)

`resolveKoreanNames`'s per-symbol `try/catch` swallows **every** error from
`getAssetInfoResilient`, including a rethrown `DYNAMIC_SERVER_USAGE` control-flow
error. Every other caller of `getAssetInfoResilient` in the repo (20+ call sites:
page.tsx, layout.tsx, options/financials/fundamental/news/congress/overall/fear-greed
pages, position/page.tsx, seo-prewarm) lets the error propagate uncaught — this is the
sole outlier. `src/shared/lib/isDynamicServerError.ts`'s own JSDoc states resilient
wrappers "must RETHROW it untouched — swallowing it... would wrongly degrade a render
Next intended to bail out of," and this exact class of bug was the #545 incident
(`getAssetInfoResilient.ts` JSDoc references it). Sibling "resilient" producers
(`getProfileResilient.ts`, `getCongressTradesResilient.ts`, `getAssetInfoResilient.ts`
itself) all check `isDynamicServerError(e)` and rethrow before degrading — this new
catch block does not. Currently latent (per `getAssetInfoStatic.ts`'s own static-analysis
comment, its chain has no cookies/headers/connection so DSU shouldn't fire today) but a
real regression trap if that invariant ever breaks.

## Recommended finding

`<RelatedSymbols symbol={ticker} />` is mounted as a plain persistent server sibling
(no Suspense) at the end of `<main>` in `[symbol]/page.tsx`, same pattern as
`TechnicalSnapshotProse`/`MobileSheetPlaceholder` — but unlike those two (which only
receive already-resolved props), RelatedSymbols now does its own `Promise.all` of up to
8 `getAssetInfoResilient` calls, adding sequential latency AFTER all of SymbolPage's own
top-level awaits complete (React must resolve the whole non-Suspended tree before this
ISR page's cold-gen/on-demand-revalidation render finishes). Impact is bounded/amortized
(revalidate=21600s, only the cold-gen requester pays it, not per-request), so this is
recommended not required. Wrapping as `<Suspense fallback={null}>` (child, not fallback)
would let the rest of the shell flush earlier without losing crawlable content — Suspense
boundaries are fully resolved before ISR commits the cached HTML absent PPR (this repo
has cacheComponents disabled per page.tsx comment), so the cached artifact is unaffected.

## Verification method

Live mutation test confirmed both new tests are real, not tautological:
- Removing the try/catch made "한글명 조회가 실패해도 링크는 전부 남는다" fail with
  `Error: DB down` (unhandled rejection) — genuine regression catch.
- `relatedSymbolsFor('NVDA')[0]` is AAPL with curated koreanName "애플"; the
  DB-override test asserts `한글-AAPL` (mocked DB name), which would fail if the `??`
  precedence in the component were flipped to curated-first — genuine, not vacuous.
Both verified by editing the file live, re-running vitest, then restoring the file byte
for byte (diff confirmed identical) before finalizing.

FSD layering (import from `@/entities/ticker` barrel) and ISR-safety of the resolver
itself (unstable_cache-wrapped, no cookies/headers/connection) are both fine — 10+
sibling files in `views/symbol/` already import the same barrel, and every other
`[symbol]/*` page already calls `getAssetInfoResilient` directly in this exact ISR
context.

See also [[seo-internal-links-relatedsymbols-r4]] for prior round context.
