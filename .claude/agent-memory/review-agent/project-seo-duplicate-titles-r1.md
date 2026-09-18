---
name: project-seo-duplicate-titles-r1
description: fix/seo-duplicate-titles R1 — approved, 4 independent SEO/build fixes verified clean
metadata:
  type: project
---

Round 1 review of `fix/seo-duplicate-titles` (worktree siglens-wt-seo). Four fixes, all
verified with zero findings:

1. OpenInterestChart/StrikeVolumeChart: SVG `<title>` replaced with `aria-label` (same
   translated string) + `aria-describedby` (desc only). Accessible name preserved.
   OpenInterestChart got a new falsifying test (title absent + aria-label/describedby
   present); StrikeVolumeChart did not get an equivalent test despite the identical
   pattern — flagged as a minor recommendation, not required (mirror-file test gap,
   not a functional risk).

2/3. `noindexSymbolMetadata`/`getBlockedSymbolMetadata` gained an optional `tab:
   SymbolSeoTab`. Verified via full grep of all 9 `getBlockedSymbolMetadata` call sites
   and all 17 `noindexSymbolMetadata` call sites: every symbol-tab route (financials,
   fundamental, congress, news, options, overall) passes its own tab at every one of
   its noindex early-returns (this matches MISTAKES 6.7 — rule applied to ALL sibling
   call sites, not just one). Root `/[symbol]` and fear-greed/position intentionally
   omit `tab` (no per-tab copy exists for those routes; JSDoc says so and code matches).
   `SymbolSeoTab` in `shared/lib/seo.ts` is declared independently (not imported) from
   `SeoSnapshotTab` in `entities/seo-snapshot/model.ts` since shared cannot import
   entities — both lists are structurally identical (verified by reading both).
   New test in `symbolIndexabilityMetadata.test.ts` asserts title/description
   uniqueness across 4 tabs of the same symbol (Set size check) — genuinely falsifiable,
   fails if reverted to always using the base builder. `expectBlockedWithOwnIdentity`
   helper's new `tabPath` param is correctly threaded through every call site (checked
   all 5 usages against the actual tab passed to the mocked function).

4. `cache-handler/config.mjs` `buildPhase = NEXT_PHASE === 'phase-production-build'`;
   s3Store `getEntry`/`setEntry` (only two exported S3-calling functions — verified via
   grep) early-return under that flag. Confirmed `next/dist/shared/lib/constants.js`
   defines a *distinct* `PHASE_PRODUCTION_SERVER` constant for runtime, so this cannot
   accidentally disable the cache in production serving — only real `next build`.
