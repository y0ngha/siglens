---
name: project-chart-overlays-siglens-r2
description: siglens feat/chart-overlays R2 — R1 fixes verified; new unmount-cleanup calls a TOGGLE, so a highlighted card dropped by a new analysis re-highlights its stale ref after ChartContent's render-phase reset
metadata:
  type: project
---

R2 (2026-09-28), worktree siglens-wt-overlays. Dedup test is falsifiable (asserts 3 unique points and 4 markers). Menu is now role=group + aria-pressed.

- New defect: OverlayHighlightButton's unmount cleanup calls `onToggle` (`prev===ref ? null : ref`). When a new analysis (analyzedAt changes) drops the highlighted card, ChartContent resets to null during render first. The cleanup then runs with a stale `isHighlighted:true` and toggles null back to the old ref. The ref is dead, so every overlay is dimmed and no button can clear it. Reproduced in a scratch jsdom harness (symlink node_modules into the scratchpad and use `./node_modules/.bin/vitest run --config`).
- The AnalysisPanel unit test mocks onToggle, so it can't catch this. The ChartContent test mocks AnalysisPanel, so it can't either.

**How to apply:** in R3, check that the cleanup uses a clear-if-equal callback, not a toggle, and that a test covers "new analysis without the highlighted id".
