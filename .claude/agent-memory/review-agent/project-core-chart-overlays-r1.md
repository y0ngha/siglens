---
name: core chart-overlays R1
description: siglens-core feat/chart-overlays R1 (uncommitted worktree siglens-core-wt-overlays) — elliott wave-state off-by-one, vacuous rule-2 test, ABC fib untested, PUBLIC_API row missing
metadata:
  type: project
---

Round 1 of feat/chart-overlays (spec docs/superpowers/specs/2026-09-28-chart-overlays-design.md, p18→p19), reviewed 2026-09-28. changes_requested.

Key findings (mutation-verified in a scratch rsync copy with node_modules symlink, `./node_modules/.bin/vitest`):
- elliottCandidates promptLine says `wave ${n} in progress` for n pivots; with includeProvisional the last pivot is the forming one, so n=4 → wave 3, n=5 → wave 4 (spec + constants.ts comment agree). n=6 ending at provisional pivot labelled "impulse complete".
- Rule-2 test fixture also violates rule 3 → deleting both rule-2 lines keeps suite green. ABC "B beyond 5" check also unkilled.
- abcCandidate (fib) has zero coverage (sign flip survives); divergence bullish-low/bearish-high and trendline ranking survive too.
- resolveChartOverlays does not check candidate kind per slot; filterAnalysisResult gates by kind not sourceRef (spec §2.6).
- Pattern section prints id when geometry!=null but toOverlay can still return null → offered id with no candidate.
- PUBLIC_API.md: no changelog row for PatternLine/patternLines/timeRange removal (major) + stale normalizePatternLine/normalizeTimeRange mention at line 623.

**How to apply:** on R2 re-run the same mutations; check the wave-state fix covers the n=6-at-right-edge case too.
