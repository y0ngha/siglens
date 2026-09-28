---
name: project-chart-overlays-siglens-r1
description: siglens feat/chart-overlays R1 (worktree siglens-wt-overlays) — core 2.0.0 chartOverlays renderer; label-dedup crash fix untested, role=menu without arrow keys
metadata:
  type: project
---

R1 (2026-09-28) of siglens-side renderer for core `AnalysisResponse.chartOverlays` (siglens-wt-overlays, uncommitted on HEAD e09864045).

- `git diff origin/master` there includes unrelated skills/docs churn because origin/master (PR #886) is ahead of HEAD — review `git diff HEAD` + untracked instead.
- Verified in LWC 5.2.1 dist: series `title` still renders as pane label with `lastValueVisible:false`; marker `size:0` skips the shape but still draws text. Not bugs.
- Core builders: only elliott/HS-pattern/fib-ABC carry labels; divergence has labels:[] so label-series-in-RSI-pane isn't reachable today.
- Findings: label time dedup (the dev-run crash fix) has no regression test; role="menu" without arrow/roving (MISTAKES a11y #2/#2.5 class); trigger count test can't tell activeCount from kinds.length; highlight survives raw→plain switch with no control; dead BASE_PATTERN_SERIES_OPTIONS and unused spec.key/overlayId.
- Dynamic `t(KIND_LABEL_KEY[kind])` widens whole `widgets.chart` onto [symbol] — measured only 3 extra keys, not worth flagging.

**How to apply:** R2 should mutation-check the dedup test (remove `.filter`) and the menu keyboard handling.
