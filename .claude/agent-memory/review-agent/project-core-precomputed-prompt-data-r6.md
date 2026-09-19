---
name: project-core-precomputed-prompt-data-r6
description: siglens-core feat/precomputed-prompt-data R6 — approved; R5 recommended items (n=0 boundary, changelog rounds 3–4) closed and mutation-verified
metadata:
  type: project
---

R6 (2026-09-19), same uncommitted worktree `/Users/y0ngha/Project/siglens-core-wt-computed`. Result: approved.
ai-levels.test.ts 74/74, tsc 0, eslint clean.

Verified by scratch-copy mutation (all killed): `isPrice` `n > 0` → `n >= 0` (mixed fixture breakout 5 / extreme 10 /
down gives measured exactly 0), all-or-nothing guard, dropping the conservative `isPrice` guard.
PUBLIC_API 2026-09-18 row claims (candidates N/A for non-positive, per-target keyPrices omission, broken vs printed
breakout, impliedMoveRange null at ≥100%, Fib/Pivot N/A) each checked against source; row keeps 3 unescaped pipes.

**How to apply:** in the scratch copy, `yarn vitest` fails (workspace not in lockfile) — call
`./node_modules/.bin/vitest run <file>` directly. Unlisted source file mtime bumps (ai-levels.ts here) can be
formatter touches; diff content against the prior round's memory before treating it as an unreported edit.
