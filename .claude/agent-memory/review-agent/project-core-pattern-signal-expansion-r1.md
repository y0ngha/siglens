---
name: project-core-pattern-signal-expansion-r1
description: siglens-core feat/pattern-signal-expansion R1 (uncommitted worktree siglens-core-wt/pattern-expansion) — changes_requested; stomach "fallback" rewrites 48% of real daily candle-pattern prompt sections
metadata:
  type: project
---

R1 (2026-09-28). 6 candles, 5 ChartPatternIds, 4 signals, p19. typecheck/lint/prettier clean, 85 scoped files green.

Required: `above/below_the_stomach` as a 2-bar "fallback" is NOT low-impact. Real FMP daily bars
(NVDA/TSLA/SPY) → stomach on 12.7% of bars; `selectLastCandlePatternEntries` output differs from HEAD in
951/1962 windows (48%), mostly stomach becoming latest multi or absorbing a single (dragonfly_doji etc.).
Requiring `isLongBody(prev)` cut it to 210 (11%). Spec premise "기존 라벨 결과 불변" holds only at
`detectMultiCandlePattern` level.

Verified clean (old-vs-new on same real bars): chart-pattern diff = only wedge→channel (+additive ids),
geometry of unchanged candidates byte-identical; existing signals + evaluateConfluence snapshots identical.

Recommended: zero-body prev fires below_the_stomach (isBullishBar is `>=`), candle `>=` boundary
mutations survive, rounding_top rim right-bound unpinned (uniform-low fixture — same trap as rounding_bottom
in [[project-core-precomputed-prompt-data-r3]]), PUBLIC_API claims siglens PATTERN_TRIGGER_CATALOG is
compile-forced (it's an untyped hand mirror), Signal.detectedAt JSDoc says seconds but all detectors emit index.

**How to apply:** real-bar probe = siglens-trader `lib/strategy/__tests__/fixtures/mr-parity.json`
(`symbols.NVDA/TSLA.bars`, `spy`; `date` strings). Old baseline = scratch copy with
`git show HEAD:<file>` overwritten for the touched modules; diff probe outputs line-by-line. Use
`--reporter=verbose --silent=false` to see console output in scratch vitest.
