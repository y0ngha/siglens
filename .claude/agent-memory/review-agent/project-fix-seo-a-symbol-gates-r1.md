---
name: project-fix-seo-a-symbol-gates-r1
description: fix/seo-a-symbol-gates R1 — 11-item Google policy fix set on /[symbol]/* tabs, all verified sound, APPROVED
metadata:
  type: project
---

R1 of fix/seo-a-symbol-gates (worktree siglens-wt-seo-a-symbol-gates), reviewed against
origin/master. All 11 purpose items (A1–A11) verified correct, no findings.

Key verifications:
- fear-greed/A1: generateMetadata's `hasPriceData` uses same `buildTechnicalFacts` predicate
  as body; `getSeedBarsStatic` confirmed wrapped in `React.cache` (entities/bars/lib/barsStaticCache.ts)
  so calling it twice with identical args (metadata + body) is a memo hit, not an extra round-trip.
- news/A2: gate predicate `!hasNewsProse(snap?.content) && !newsItemsForGate.some(sentiment!==null)`
  is the exact negation of body's `showNewsProse || hasEnrichedNews` — parity confirmed. `getNewsList`
  gate call uses same `staticSymbolCache` key/locale as body (unstable_cache, not React.cache, but
  same key = cache-layer hit per project convention).
- fundamental/A3: same congress-page shape, `hasFundamentalProse` predicate matches body exactly (grepped).
- chart/A4: `degraded: degraded || metadataBars === null` correctly folds a thrown bars fetch into the
  existing "degraded → indexable only with renderable snapshot" path via `getBlockedSymbolMetadata`'s
  `tab: 'technical'` + `hasSnapshot` lookup. `hasPriceData` kept separate (undefined on throw) so
  infra-failure and no-price-data don't get conflated.
- news/A5: `getTodayIsoDay` fully deleted (source+test), zero remaining code references (only historical
  rationale comments). `dateModified` now `newsItems[0]?.publishedAt ?? snapshot?.generatedAt ?? null`,
  field omitted entirely when both absent (spread guard).
- news/A6: Article JSON-LD gated on `showNewsProse` (matches [[project-market-fg-percentile-window-slice|MISTAKES 15.5]] visible-content-only pattern).
- A7: `symbolWebPageJsonLd.ts` new helper adds `dateModified` (ISO, generatedAt-null-safe) +
  `publisher: {@id: ORGANIZATION_JSON_LD_ID}` referencing the same @id the homepage/about page use
  (grepped, no duplicate Organization declarations). Rolled out to all 9 tabs — grepped zero remaining
  bare `buildWebPageJsonLd(` calls under [symbol]. position/fear-greed correctly omit `generatedAt`
  (no snapshot renderer, per JSDoc).
- A8: exactly 4 sr-only sections removed (congress, news, chart/page.tsx, financials) — content folded
  into existing visible FAQ/prose, single-source invariant preserved.
- A9: evaluateSymbolIndexability.ts had a literal duplicate locale-gate if-block; second copy deleted,
  first retained unchanged. Clean dedup, zero behavior change.
- A10: RelatedSymbol gained `reason`/`label` fields; `THEME_GROUPS`/`CROSS_MARKET_THEME_GROUPS`/
  `SUPPLEMENTAL_THEME_GROUPS` converted from bare string[][] to `LabeledGroup[]`. `roundRobinMerge`
  generalized to `<T>` with a `keyOf` extractor — iteration order (rank-major, then group-major) proven
  identical to the old flatMap+Set version by diff inspection. Orphan-zero dedupe/budget/count logic in
  `relatedSymbolsFor` unchanged, only wrapped candidates in `{symbol,label,reason}`. 21 new i18n keys
  (9 theme + 11 sector + spaceDefense) verified present and distinctly-translated across all 4 locales
  (en/ja/ko/zh) via direct JSON inspection — no copy-paste-only translations.
- A11: new guard test `internalLinksArePrewarmed.test.ts` iterates `POPULAR_TICKERS ∪ POPULAR_CRYPTOS`
  (confirmed via grep this is exactly `relatedSymbolsFor`'s own ring universe — `SYMBOL_LINK_RINGS`
  is built from the identical two constants) and asserts every `relatedSymbolsFor(x)` target is in
  `buildPrewarmUniverse()`. Non-vacuous by construction (same-universe check, not independently-guessed set).
- RelatedSymbols.tsx: no hooks (async server component) — MISTAKES §17 N/A. `getTranslations()` with
  no namespace + full dotted key path is an established repo pattern (grepped: news/page.tsx,
  fmpUserMessage.ts, getBarsAction.ts all do the same).
- Ran all 14 touched/new test files directly via `yarn vitest run <files>` — 168 tests, all green.
- No `getTodayIsoDay` references remain anywhere in src/ except two historical rationale comments.

Verdict: approved, zero findings (required or recommended).
