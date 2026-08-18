---
name: asset-translations-no-self-heal
description: entities/ticker's asset_translations table does not self-heal when korean_tickers ingestion is fixed — it must be manually corrected, unlike korean_tickers which does self-heal via onConflictDoUpdate
metadata:
  type: project
---

`getAssetInfo.ts`'s lookup order for a symbol is: 1-year cache (`asset-info:<symbol>`) →
`asset_translations` DB table (`readFromDatabase`) → crypto checks → KR-equity path
(`resolveKrEquityAssetInfo`, which reads `korean_tickers` ?? `CURATED_KOREAN_NAMES`).
`asset_translations` is checked *before* the KR-equity path and, once a row exists there,
is returned forever — there is no TTL and no re-derivation, unlike `korean_tickers` whose
`upsertMany` always overwrites `koreanName` via `onConflictDoUpdate` on every cron/seed run.

**Why:** Found while fixing PR-adjacent audit item 2 (`035420.KS` NAVER→네이버 curation bug,
2026-08-18, `docs/architecture/SCOPE.md`-adjacent siglens work, not core). Ingestion-level
fixes to `toKoreanTickerRows.ts` (prefer `CURATED_KOREAN_NAMES` over the KRX feed value) only
self-heal `korean_tickers` on the *next* cron/seed run. If the symbol was ever visited in
production before the fix, `resolveKrEquityAssetInfo`'s `if (koreanName) { persistTranslation(...) }`
branch already wrote the wrong value into `asset_translations` too, and that table has no
mechanism to notice `korean_tickers` changed underneath it. The 1-year `asset-info:<symbol>`
cache key (`buildAssetInfoCacheKey`) is a *third*, independent stale layer on top of both.

**How to apply:** Any future "wrong curated/translated name persisted" bug in this ticker
pipeline needs **three** things checked/invalidated, not just the ingestion source:
1. `korean_tickers` row (self-heals next cron/seed — usually no manual action needed).
2. `asset_translations` row for the symbol (does **not** self-heal — needs a manual
   UPDATE/DELETE after the ingestion fix lands).
3. The `asset-info:<SYMBOL>` cache key (`buildAssetInfoCacheKey`, `KOREAN_TICKERS_CACHE_KEY`
   bulk cache too) — invalidate *after* step 1/2 are done, or a premature cache rebuild just
   re-caches the stale value for another year.

See also [[mutation-test-via-git-show-not-stash]] for how this was verified alongside the
`toKoreanTickerRows.ts` fix.
