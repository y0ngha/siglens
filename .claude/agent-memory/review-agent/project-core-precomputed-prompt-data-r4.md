---
name: project-core-precomputed-prompt-data-r4
description: siglens-core feat/precomputed-prompt-data R4 — R3 fixes verified by mutation, but PUBLIC_API still omits LlmStrikeOpenInterest (new in both barrels); rim-span fixture only pins bounds 2 bars out
metadata:
  type: project
---

R4 (2026-09-19), same uncommitted worktree `/Users/y0ngha/Project/siglens-core-wt-computed`. Result: changes_requested.
Scoped tests 463/463 green, tsc 0 errors, eslint clean on modified files.

Verified by scratch-copy mutation (all killed): isBroken on raw breakout, dropping the `level <= 0` N/A guard,
Fib/ABC table helpers using formatNullableNumber, ai-levels dropping isPrice(measured), rim `.slice(0)`.

New findings:
- Required: `LlmStrikeOpenInterest` newly exported from src/index.ts AND src/index.client.ts, absent from
  PUBLIC_API.md entirely (options Tier 4 list + changelog row) — the R4 fix claimed "list every type
  index.client re-exports". Enumerate `git diff -- src/index.ts src/index.client.ts | grep '^+'` and grep each in docs.
- Recommended: rim-span fixture neighbours (index 1 = 20, index 9 = 21) are below the lip 23, so
  `slice(spanStart - 1, …)` survives; test comment falsely says 21 is higher than the lip.
- Recommended: ai-levels mixed case (measured ≤ 0, conservative > 0) untested — all-or-nothing mutation survives,
  while the candidates section prints exactly that mixed case.
- Recommended: formatPivotTableLine inserted between the orphaned "Design C" comment and formatMarketReferenceSection.

**How to apply:** for doc-completeness fixes, diff the barrels' `+` lines against PUBLIC_API.md mechanically rather
than trusting the fix summary's scope. For "bounds" tests, check the bar IMMEDIATELY outside each bound beats the answer.
