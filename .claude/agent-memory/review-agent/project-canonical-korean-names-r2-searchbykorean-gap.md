---
name: canonical-korean-names-r2-searchbykorean-gap
description: R2 of canonical-korean-names PR fixed getKoreanNames but missed searchByKoreanName (koreanEntryToSearchResult), the third consumer of the same korean_tickers table
metadata:
  type: project
---

PR adds `CANONICAL_KOREAN_NAMES` map to fix inconsistent Korean stock names
across symbol-page/home/dashboard/search. R1 found the override needed to
also apply inside `getKoreanNames` (koreanNameStore.ts) since it reads a
different table (`korean_tickers`) than `getAssetInfo`'s exit point
(`asset_translations`).

R2 fixed `getKoreanNames` correctly (mutation-verified: reverting
`CANONICAL_KOREAN_NAMES.get(symbol) ?? symbolMap.get(symbol)` back to
`symbolMap.get(symbol)` fails 2 of the 3 new tests). But `koreanNameStore.ts`
exports a **third** consumer of the same `korean_tickers` data —
`searchByKoreanName` (used for Korean-input queries in `searchTicker.ts`,
`isKoreanInput(trimmed)` branch) — via `loadAllEntries()` +
`koreanEntryToSearchResult()`. Neither the substring-match predicate nor the
returned `koreanName` field ever consults `CANONICAL_KOREAN_NAMES`. Zero test
coverage of this interaction (`describe('searchByKoreanName', ...)` block has
no canonical-related tests).

Consequence, confirmed by tracing `searchTicker.ts`'s English-query branch
too: `getKoreanNames`'s `unmapped` filter (`enriched.filter(r =>
!r.koreanName)`) now treats canonical symbols as always-resolved, so
`translateAndCache`/`setKoreanTickers` (and the equivalent
`translateAndPersist` path in `getAssetInfo.ts`) never run for them again —
the stale/wrong `korean_tickers` row is now *permanently* frozen (self-heal
path structurally can't fire). Combined with `searchByKoreanName` not
applying the override: typing the canonical Korean name for one of these
symbols returns zero results (substring match against the still-wrong stored
value fails), while typing the old wrong name still surfaces the wrong name
in the dropdown — the exact defect the PR claims to close for "search
autocomplete."

Lesson: when a fix introduces a lookup map that must override multiple
consumers of the same underlying table, grep **every** function touching
that table (not just the one path the bug report named) — `loadAllEntries`
callers here, analogous to [[feedback-audit-enumerate-slice-not-difflist]].
Also watch for "now always truthy" changes to a `koreanName`/optional field
silently disabling a `!field`-gated background-refresh branch elsewhere in
the same file (`unmapped` filter in `searchTicker.ts`).
