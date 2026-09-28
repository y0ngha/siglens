---
name: prewarm-no-news-starvation-r2
description: R2 of fix/prewarm-no-news-starvation (siglens-fmp-guard worktree) — all 10 R1 findings verified fixed and mutation-killed; residual gaps are overall-tab newsFetchFailed asymmetry, unenriched-row gate no-op for run_fresh_analysis, doc drift
metadata:
  type: project
---

Branch `fix/prewarm-no-news-starvation` (worktree `/Users/y0ngha/Project/siglens-fmp-guard`), round 2: no blocking findings.

R1 fixes all verified by mutation in a `cp -al` scratch copy (`./node_modules/.bin/vitest run <file>`):
14d→1d QUOTE_MAX_AGE_MS, raw-reject-cached memo, dropped lookback arg, always-gate / gate-before-validation,
dropped `newsFetchFailed` guard, dropped `newsFetchFailed` producer, removed get_news gate — **all killed**.

Surviving mutations worth remembering:
- `QUOTE_MAX_AGE_MS` 14d→**30d** survives (only the KRX 7d17h test pins the lower side; upper side unpinned).
- Moving the `run_fresh_analysis` gate to just **before** the `busy` slot check survives — the "after slot
  acquisition" half of the ordering claim has no test (only the before-validation half does).

Residual design gaps found in R2:
- `newsFetchFailed` can only ever be set by `prewarmNews`; `prewarmOverall` doesn't ingest, so on an
  FMP-outage night a dry symbol gets news=30min but overall=24h. `TAB_ORDER` puts news before overall,
  so the normal recovery tick is safe — the residual is one delayed day after an outage.
- `ensureSymbolNewsFresh` ingests raw rows only; `buildAnalysisNewsItems`/`isEnrichedRow` filter unenriched
  rows, so the gate cannot change a `run_fresh_analysis` kind=news/overall answer in the same turn
  (`get_news` is different — `listCardsBySymbol` returns unenriched rows).
- `SymbolFreshnessResult` is never consumed in production (`ensureSymbolData` is `Promise<void>`), yet its
  JSDoc says the caller puts it in an envelope for the model.

Related: [[project-seo-prewarm-rotation-mutation-verify]], [[feedback-audit-enumerate-slice-not-difflist]].
