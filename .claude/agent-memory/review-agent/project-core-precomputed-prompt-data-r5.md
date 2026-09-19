---
name: project-core-precomputed-prompt-data-r5
description: siglens-core feat/precomputed-prompt-data R5 — all R4 items verified (rim bounds + mixed-case mutation-killed); only recommended left: n=0 target boundary untested, changelog row stops at "Review round 2"
metadata:
  type: project
---

R5 (2026-09-19), same uncommitted worktree `/Users/y0ngha/Project/siglens-core-wt-computed`. Result: changes_requested (recommended only).
Scoped tests 493/493, tsc 0, eslint clean.

Verified: LlmStrikeOpenInterest in PUBLIC_API options Tier 4 + changelog; rim fixtures now have 30 immediately
outside each bound (left/right widen, `.slice(0)`, spanEnd mutations all killed); ai-levels mixed case kills the
all-or-nothing mutation; Design C comment back above formatMarketReferenceSection (matches HEAD placement).

Recommended:
- ai-levels `isPrice` `n > 0` → `n >= 0` survives (no exact-zero target fixture). Also `isPrice` duplicates the
  file-local `isFinitePositive` at line ~48 (ai-levels.ts not in R5 modified_files, so not raised).
- PUBLIC_API 2026-09-18 row ("all rounds") only narrates "Review round 2"; R3 behavior changes (non-positive
  targets → N/A / dropped from keyPrices, broken-status vs printed breakout) missing; "as of the review-round fix
  below" (2dp rounding) points at nothing.

**How to apply:** scratch-copy mutation setup = `cp -R src vitest.config.ts tsconfig.json package.json` + symlink
node_modules, then python anchor-replace with `assert count==1` (assert catches ambiguous anchors — `n > 0` hit 2).
