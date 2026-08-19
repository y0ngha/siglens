---
name: project-core-048-briefing-context
description: core 0.48.0 wiring review (MarketBriefingContext / EconomicEventAnalysisInput.region) — what was verified true in core dist, and where the residual risk sits
metadata:
  type: project
---

`feat/asset-class-navigation` last-two-commits delta wired siglens to `@y0ngha/siglens-core@0.48.0`.
Verified directly against `node_modules/@y0ngha/siglens-core/dist` (not against the PR description):

- `hashBriefingInput(indices, sectors, context)` folds `marketLabel` and `volatility` into the key.
  Write path (`submitMarketBriefingAction`) and read path (`peekBriefingStatic`) both call the one
  shared `marketBriefingContextOf` helper, so context introduces **no new** key divergence. The
  summaries the two paths hold already differ intraday (Redis 1-min TTL vs `unstable_cache` 1h ISR
  freeze) and quotes are hashed too — that pre-existing mismatch dominates the peek hit rate.
- `buildMarketBriefingPrompt` gates volatility on `Number.isFinite(level) && level > 0`, so the
  `price: 0` fetch-failure sentinel is dropped **from the prompt** — but `hashBriefingInput` folds
  the raw `level: 0` into the key regardless. A comment saying "core sanitizes it" is only half true.
- `getMarketSummary` emits `symbol: idx.symbol` (canonical, `'VIX'`) alongside `fmpSymbol`
  (`'^VIX'`), so a `summary.indices.find(i => i.symbol === scope.volatilityIndexSymbol)` lookup is
  correct. `summary.sectors` is built from `sectorEtfs` only, so the prompt can emit **only**
  `scope.sectorEtfs[].koreanName` — `signalSectors` in a `knownSectors` allowlist is dead for KR and
  over-permissive for US (`'양자'`/`'우주'`).
- `EconomicEventAnalysisInput.region` is required and folded into `hashEconomicEventInput`; the
  few-shots carry both `Region=미국` and `Region=한국`. Re-enabling KR is safe in `src/` —
  `listUnanalyzedAnnounced` caps at `UNANALYZED_SCAN_LIMIT = 20` behind a 30-min per-country flag.

The real miss was outside `src/` — see [[feedback-scripts-excluded-from-tsc]].
`widgets/dashboard/MarketDataErrorNotice.tsx` still hardcodes "미국 증시" and renders on
`/market/kr`, found by grepping the *string* repo-wide rather than reading the diff list
([[feedback-audit-enumerate-slice-not-difflist]]).

Related: [[project-asset-class-nav-r5]], [[project-prompt-region-context-r6]].
