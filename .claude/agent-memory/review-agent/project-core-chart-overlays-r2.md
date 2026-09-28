---
name: core chart-overlays R2
description: siglens-core feat/chart-overlays R2 — all R1 fixes mutation-killed; new elliott same-index crash fix (EW_MIN_WAVE_BARS gap) is unfalsifiable, runsForward + no-ref warn untested
metadata:
  type: project
---

R2 of feat/chart-overlays (worktree siglens-core-wt-overlays, uncommitted), 2026-09-28. changes_requested.

R1 fixes all killed by mutation: wave-label n-1, atRightEdge, rule-2 partial/full, bBeyondFive, offered-id gate, slot kind gate, HS neckline, skill stem, ABC fromTime/labels.

New dev-server fix (zero-length waves from same-index high+low pivots) is NOT pinned:
- dropping the `p.index - prev.index >= EW_MIN_WAVE_BARS` clause, or EW_MIN_WAVE_BARS=0, stays green. The test titled "closer than EW_MIN_WAVE_BARS" is really killed by EW_MIN_IMPULSE_SPAN_BARS (5-bar span); span=0 alone also survives — only both-to-0 fails.
- `.filter(runsForward)` removal green; `[ChartOverlays] no candidate referenced` warn untested.
- Spec §3.5 doesn't mention the new gap/span gates.

**How to apply:** on R3 re-run: wave0, span0, noIndexGap, noRunsForward, noRefWarn mutations (perl -0pi in scratch rsync copy, ./node_modules/.bin/vitest).
