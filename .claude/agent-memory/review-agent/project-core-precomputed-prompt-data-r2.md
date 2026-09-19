---
name: project-core-precomputed-prompt-data-r2
description: siglens-core feat/precomputed-prompt-data R2 — R1 fixes verified, but the R6 "byte-identical targets" fix computes from raw values while the model copies priceDp-rounded ones; PUBLIC_API claims exports that don't exist
metadata:
  type: project
---

R2 (2026-09-19), worktree `/Users/y0ngha/Project/siglens-core-wt-computed`, still uncommitted. Result: changes_requested.
R1 items R1-R5, R7-R14, R17-R19 re-probed and fixed (calendarDayDiff, NaN sector split, ABC strict retracement).

New defects found:
- `chartPatternCandidatesSection.formatCandidate` calls `computePatternTargets` on RAW breakout/extreme,
  prints them at priceDp; model copies printed values → ai-levels recomputes different targets
  (probe: triangle printed 113.48 vs 113.49). `conservativeDp = max(priceDp, decimalPlacesOf(raw))`
  prints 8 decimals (`97.98833333`). Test "byte-identical regardless of caller" is tautological
  (same fn, same inputs twice). Fix = round inputs to priceDp first.
- PUBLIC_API.md lists `PivotPoint`/`PivotKind` as new Tier 4 exports; they are `@internal` and absent from src/index.ts.
- `buildPlanCheck` newly exported from src/index.ts but still `@internal`, no @param/@returns; it and
  `planEntryPrice` missing from PUBLIC_API.md.
- Recommended: index.client.ts closure gaps; negative Fib ext prices in `Fib table:`/`Fib ABC table:`;
  cup rim = max of LOW pivots; lazy currentPrice getter rejection not caught.

**How to apply:** in R3, probe the candidates section with non-round (OLS / averaged) geometry and feed its
printed Breakout/Extreme into computePatternTargets; grep src/index.ts for every symbol PUBLIC_API.md's
changelog row claims. vite-node probe: `./node_modules/.bin/vite-node --config vitest.config.ts <scratch>.ts`
from the worktree root (keep the script in scratchpad — never copy into the worktree).
