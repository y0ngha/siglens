---
name: core chart-overlays R3
description: siglens-core feat/chart-overlays R3 — gap/span/no-ref-warn mutations now killed; `.filter(runsForward)` wiring removal still survives (predicate unit-tested only)
metadata:
  type: project
---

R3 of feat/chart-overlays (worktree siglens-core-wt-overlays, uncommitted), 2026-09-28. changes_requested (recommended only).

Killed: EW_MIN_WAVE_BARS=1, span=0, dropping the index-gap clause, removing the `no candidate referenced` warn. Spec §2.1/§3.5 match source.

Survivor: deleting `.filter(runsForward)` in buildOverlayCandidates stays 96/96 green — the fix exported+unit-tested the predicate, not its wiring.

**How to apply:** R4 — re-run the norf mutation. Mutation loop in zsh: do NOT put test paths in `$T` (zsh no word-split → "No test files found" silently); pass paths literally.
