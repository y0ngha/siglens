---
name: project-core-detectors-consume-r2
description: siglens feat/core-detectors-consume R2 — R1 findings fixed and verified, approved
metadata:
  type: project
---

R2 (2026-09-28, worktree siglens-sp3): approved. All 3 R1 findings verified fixed:
- 52-week-high-momentum.md / gap-analysis.md: "detected-signal section" wording replaced with
  "injected only when engine detected X; derive side/direction from bar data / Market Reference".
- Tautological "close above MA(120)/MA(200)" criterion removed from Output/Digest section.
- loadNewsMacroCalendar.ts uses .toSorted(); test uses 2026-09-29T02:00:00Z (UTC 09-29 = ET 09-28
  22:00), a genuinely UTC-vs-ET-distinguishing instant, with explanatory comment.
Ran yarn skills:digest-verify (98 valid), yarn validate:skills (98 validated), and the
loadNewsMacroCalendar test file (3/3 passed) — all green.
