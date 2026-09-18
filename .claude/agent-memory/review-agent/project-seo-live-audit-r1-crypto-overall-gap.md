---
name: project-seo-live-audit-r1-crypto-overall-gap
description: fix/seo-live-audit R1 — 6-finding live-crawl audit fix (UA-neutral briefings, fear-greed always-noindex, sitemap prose gate, thin descriptions, YMYL backtest span, empty options section). All 6 core changes verified correct; only gap is buildCryptoPopularEntries not wired to the new prose gate.
metadata:
  type: project
---

Branch `fix/seo-live-audit` (worktree `siglens-wt-seo-live`), round 1. Six findings from a
2026-09-17 production crawl audit (Googlebot UA curl of 3,166 sitemap URLs + Playwright
bot-vs-human render diff). All 6 verified correct on review:

1. **UA-conditional briefing cloaking removed.** `submitMarketBriefingAction`/
   `submitMacroBriefingAction` no longer import `isBot` at all; `botBlocked` removed from
   `MarketBriefingActionResult`/`MacroBriefingActionResult` types. Hooks (`useMarketBriefing`,
   `useMacroBriefing`) keep a defensive `if (!data.briefing) return { input: seedInput }` for
   rolling-deploy old-container responses, tested by injecting `{ briefing: null, botBlocked:
   true } as never` (type no longer allows it, `as never` is the correct escape hatch — not a
   defect). `messages/*.json` bot-notice keys (`903a71`, `bf366f`) removed cleanly across all 4
   locales + hashes.json/clientKeys.json, confirmed zero remaining references.
   `BotBlockedNotice.tsx` (a *different*, intentionally-unchanged component for symbol-tab bot
   gating) still owns its own separate keys (`shared.ui.BotBlockedNotice.*`) — initially looked
   like a stray leftover reference until tracing confirmed `MarketSummaryPanel.tsx` (origin/master)
   used to import `BotBlockedNotice` directly for its `input === null` branch; removing that
   import legitimately dropped those keys from the `/market` route's `clientKeys.json` bucket
   (verified via `git show origin/master:...` + python route-bucket diff).
2. **`/{symbol}/fear-greed` always noindex** — same pattern as `/position` (hook copy kept,
   `NOINDEX_SYMBOL_METADATA` spread after). `buildPopularEntries`/`buildCryptoPopularEntries` no
   longer emit `/fear-greed`. Tests updated symmetrically (symbol-metadata canonical-regression
   guard, page.metadata.test.ts price-gate tests replaced with always-noindex tests).
3. **Sitemap prose gate** — new `DrizzleSeoSnapshotRepository.listFreshSymbolTabs` +
   `loadPopularSitemapInputs` (`unstable_cache`, 1h, fail-open to `{}` on DB error) feeds
   `buildPopularEntries(now, { symbolTabsWithProse })`. Verified the exact footgun named in the
   review brief does NOT occur: the cached function returns `string[]`, the `Set` is built only
   *after* unwrapping from `unstable_cache` in `loadPopularSitemapInputs` — the untracked test
   `loadPopularSitemapInputs.test.ts` proves this with a mock `unstable_cache` that forces a real
   JSON round-trip. `SNAPSHOT_MAX_AGE_MS` is the same constant imported by both the page gate
   (`getSeoSnapshotsStatic`) and the sitemap loader — single source of truth, confirmed by grep.
   Route (`api/sitemap/popular/route.ts`) correctly made async and awaits the loader.
4. Thin meta description fix (`PLAIN_DESCRIPTION_MIN_LENGTH = 40`) — correctly measures only the
   plain-text portion (`[...whole].length`), excluding the `${subject} — ` prefix. Test coverage
   has a below-threshold case (~19 chars) and clearly-above-threshold cases, but no test pinned
   right at the 39/40/41 boundary (MISTAKES §18 spirit) — flagged recommended, not required.
5. YMYL backtest span — `temporalCoverage` now derived from `STATS.periodStart/periodEnd`
   (`deriveBacktestStats`, module-level, computed once from static `data.json` — not a
   per-request `Date.now()` cacheComponents violation). `SITE_BUILD_DATE` correctly dropped only
   from the `DataDownload.dateModified` field it was misused for; still used correctly elsewhere
   in the codebase (grepped, 5 other legitimate call sites). "AI stock prediction" → "AI stock
   analysis" keyword change confirmed with zero remaining "AI stock prediction" occurrences.
   "2년치/2년 백테스팅" removed from home card + manifest description across all 4 locales; a
   repo-wide grep for "2년" turned up only unrelated hits (2-year Treasury note, 2-year bars
   lookback window, etc.) — no leftover YMYL overclaim.
6. `OverallView` now gates the options section on `r.optionsBulletsKo.length > 0` (in addition to
   `isEquity && hasOptions`); `OptionsSummary` no longer renders an empty state. New
   `OverallContent.test.tsx` case is mutation-falsifiable (revert the `.length > 0` guard → test
   fails). `OptionsSummary.test.tsx`'s old empty-bullets test was correctly removed rather than
   left dangling.

**Only gap found**: `buildCryptoPopularEntries.ts` still unconditionally lists `/{crypto}/overall`
with no `symbolTabsWithProse`-equivalent gate, even though `/[locale]/[symbol]/overall/page.tsx`'s
`generateMetadata` applies the exact same `hasOverallProse` noindex gate to crypto symbols as to
stocks (confirmed: `hasOverallProse` has no asset-class branch, and a pre-existing code comment in
`overall/page.tsx` — from an earlier, unrelated audit round — explicitly states crypto reliably
keeps fresh snapshots even through cold ISR, unlike KR equity). This is the MISTAKES §6.7 shape
(same upstream gate, one sibling route fixed, one not) but current practical risk is low per that
comment and the live audit's measured 108+49 count was 100% from `POPULAR_TICKERS` (stock), not
`POPULAR_CRYPTOS` — filed as recommended, not required. `src/app/api/sitemap/crypto/route.ts` (the
consumer) is untouched by this branch, confirming this wasn't in scope, just not extended to.

**Verification method**: read every changed file's current content (not `git diff` hunks) plus
`git show origin/master:<path>` for removed-import confirmation; traced clientKeys.json route
bucket membership with a small python script rather than assuming stray-looking key removal was a
bug; grepped `hasOverallProse`/`CRYPTO_DESCRIPTOR.tabs` to confirm the crypto-gap claim before
writing it up (initial hypothesis was disproven once, revised once — worth the extra grep).

**How to apply**: if a later round wires the prose gate into `buildCryptoPopularEntries` too,
verify the wiring the same way as `buildPopularEntries` (JSON round-trip test, fail-open on DB
error, `SNAPSHOT_MAX_AGE_MS` reuse). If clientKeys.json ever looks like it's dropping keys a
still-live component needs, check for a same-named *different* component/key collision and a
recently-removed *import* before assuming it's a defect — grep the removed import's origin/master
history first.

**Round 2 — closed.** All 4 recommended findings verified fixed:
1. `buildCryptoPopularEntries` now takes `BuildPopularEntriesOptions` and gates `/overall` on
   `symbolTabsWithProse` exactly like `buildPopularEntries` (undefined → emit, set-without-entry →
   skip). Route awaits `loadPopularSitemapInputs()` and threads it through. New tests cover the
   gated/ungated cases and pin the 3-per-coin count.
2/3. Dead `isBot` mock scaffolding removed from both briefing action tests; bot-UA tests now feed
   a real Googlebot UA through the `next/headers` mock so the real `isBot` (not a stub) is
   exercised — verified this is non-vacuous per the author's own mutation note (temporarily
   re-adding an isBot gate made exactly the 3 new/rewritten tests fail).
4. `seo.test.ts` got an `it.each([[40, true], [39, false]])` boundary test for
   `PLAIN_DESCRIPTION_MIN_LENGTH`; confirmed the 40-char fixture is exactly `PLAIN_DESCRIPTION_MIN_LENGTH`
   chars via `'가'.repeat(length - 2) + '다.'`, and the implementation's `>=` comparison at
   `src/shared/lib/seo.ts:725` matches (40 passes, 39 falls back to raw).

No new findings. Loop closed, approved.
