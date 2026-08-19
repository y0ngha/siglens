---
name: asset-class-nav-r5
description: feat/asset-class-navigation round-5 closing review — nav overview-link tests verified by simulation, news category title width arithmetic re-measured
metadata:
  type: project
---

`feat/asset-class-navigation` (worktree `/Users/y0ngha/Project/siglens-ax`) round 5: verified
`hasRegionForRoot`/`NAV_OVERVIEW_LINKS` tests, sector-signal cache test cleanup, economy SSR
comment restore, and the `/news/[category]` title shortening.

**Why:** the round-4 fixes each touched a spot where a one-character predicate or a width
constant decides an SEO-visible outcome, so "looks fixed" was not enough — both had to be
re-measured independently.

**How to apply:**
- Falsifiability of a pure-config predicate can be proven **without mutating the repo**: copy the
  const tree into a scratchpad `.mjs`, run it with the predicate both original and inverted, and
  check every new assertion flips. Review agent is read-only; never mutate the worktree to test.
- SEO title budgets in this repo are measured with `seoTitleWidth` (한글/전각 = 2, `—`/`·`/`…`
  deliberately = 1). `SEO_TITLE_MAX_WIDTH` is 55 and `' | Siglens'` is exactly **10** wide, so any
  comment claiming "X bare → X+11 with suffix" is arithmetically impossible. Re-run the width
  function on every measured string quoted in a comment — the 2026-08-19 `SITE_SUFFIX_WIDTH`
  JSDoc quoted the *new* wording next to the *old* wording's numbers.
- Round-N "swap the fixture" fixes tend to collapse two tests into byte-identical duplicates
  (here: `(guard: true) stocks가 있으면 set 호출` vs the ratio-guard regression pin, both
  `US_DASHBOARD_SCOPE` + `'1Day'` + `expect(set).toHaveBeenCalled()`). After any fixture removal,
  diff the surviving tests against each other, not just against the removed fixture.

**Closing round (2026-08-19, `scripts/seedEconomicEventAnalysis.ts` +
`widgets/dashboard/__tests__/MarketSummaryPanel.test.tsx`) — approved.** What actually had to be
re-derived rather than trusted:
- A prop asserted only against `TEST_SCOPE` is unfalsifiable whenever `TEST_SCOPE`'s value equals
  the plausible hardcode (`marketLabel: '미국 증시'`). The fix must set the KR fixture's field
  **explicitly**, not by spread — a spread-inherited override is the same bug wearing a KR label.
  Note the residual: `marketLabel` reaches `MarketDataErrorNotice` from *two* call sites in
  `MarketSummaryPanel.tsx` (total ~L86, partial ~L104); only the total branch is pinned.
- Backfill-loop termination: two exits (`pending.length === 0` = clean, `analyzed === 0` = abort).
  Verify the abort exit can't be starved — `attachEventAnalysis` really does set `analyzedAt`, so a
  succeeded row cannot re-enter the scan and inflate the counter. Failure rows re-enter by design,
  which is exactly why "wait for an empty scan" alone would spin forever.
- `process.exitCode = 1` after the final log inside `try` covers *both* breaks and does not fight
  the `run().catch` handler (both set 1). The abort path always has `failedIds.size > 0` because
  `analyzed === 0` with a non-empty page means every row was added.
- Comment arithmetic re-measured: KR sector ETFs really are 6 (`signalSectors: KR_SECTOR_ETFS`,
  "신호 탭과 시세 카드가 같은 6종"), and `/market/kr` really is sitemap priority 0.9 — it comes from
  `buildStaticEntries`'s `regionEntries` (`isMarket ? 0.9 : 0.8`), not a literal, so grepping for
  the string `market/kr` in sitemap files returns nothing and looks like a false claim.

Related: [[project-audit-fix-seo-root-title-spcx]], [[project-crypto-assetclass-session]],
[[feedback-audit-enumerate-slice-not-difflist]], [[feedback-scripts-excluded-from-tsc]]
