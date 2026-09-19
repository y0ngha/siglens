---
name: project-core-precomputed-prompt-data-r3
description: siglens-core feat/precomputed-prompt-data R3 — all R2 items fixed (226k-case printed-vs-recomputed probe 0 mismatches), but PUBLIC_API says index.client re-exports only PivotTables (it now exports 12 more); negative measured targets still printed; two new test gaps survive mutation
metadata:
  type: project
---

R3 (2026-09-19), same uncommitted worktree `/Users/y0ngha/Project/siglens-core-wt-computed`. Result: changes_requested.
Full suite 244 files / 4724 tests green, tsc + eslint clean on modified files.

Verified fixed: candidates section rounds breakout/extreme to priceDp before `computePatternTargets`
(random property probe over 13 families x priceDp {0,1,2,3,4,6,8}: 0 mismatches); PivotPoint/PivotKind
exported; buildPlanCheck docs; rejecting currentPrice getter caught (mutation "drop await" killed).

New findings:
- Required: PUBLIC_API.md Tier 4 note "`index.client.ts`에는 `PivotTables`만 재노출" became false once
  the R2 closure fix added the pivot/fib/pattern-target types to index.client.ts (docs lag the fix).
- Recommended: negative "Measured target" still printed (descending triangle fixture seed 15/high 25/lows 10
  → -4.15), same class as the R2 Fib-table N/A fix; ai-levels appends the same negative keyPrice.
- Recommended: `isBroken` uses the RAW breakout while printed breakout is rounded → "(broken)" next to
  "Breakout level: 20.00 (+0.00% from last close)".
- Test gaps (mutation survivors): Fib/ABC table → formatTablePrice wiring; curvature rim span bounds
  (fixture has every high = 20, so `.slice(0)` survives).

**How to apply:** when a round's fix widens a barrel (index.client.ts), re-grep PUBLIC_API.md for
sentences scoping what that barrel exports ("만 재노출", "only"). Uniform-value fixtures (all highs equal)
cannot pin a max/argmax span — check for that whenever a fix changes which bars a reduction scans.
