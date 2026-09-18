---
name: project-core-precomputed-prompt-data-r1
description: siglens-core feat/precomputed-prompt-data R1 (worktree siglens-core-wt-computed, uncommitted) — changes_requested; date-only day-count off-by-one, NaN sector spread, prompt-rule contradictions
metadata:
  type: project
---

R1 (2026-09-19), 70 files, work uncommitted in `/Users/y0ngha/Project/siglens-core-wt-computed`
(HEAD == origin/main, so review `git diff` + `git status` untracked). Ignore `scripts/probe-output/`
(it alone fails typecheck/lint).

Required findings (all reproduced with a vite-node probe against the worktree src):
- `newsPrompt.formatDayOffset` / `fundamentalPrompt.computeDaysToEarnings`: `Math.round((dateOnly - now)/day)`
  → at 20:00 UTC today's earnings read "1 days ago", tomorrow "in 0 days". Compare calendar dates.
- `marketBriefingPrompt`: a NaN `changesPercentage` prints `Best − worst sector spread: NaN%p` and the
  NaN comparator mis-ranks (+2.00% ranked below +1.20%). siglens `getMarketOverview` already filters unrankable rows.
- Prompt contradictions: keyPrices label examples still list "목표가"/"a target price" while a new rule forbids
  target keyPrices; "structured price fields (… geometry) never derived arithmetically" vs geometry rule
  extremeLevel = "peak/trough average" (siglens double-top skill says the same).

Test quality was strong: 30 hand-applied mutations in a scratch copy of src (vitest config copied,
node_modules symlinked) — all killed. Mutation-in-scratch-copy is a workable way to check test
falsifiability without touching the worktree.

**How to apply:** in R2, re-probe the two date helpers at a post-12:00-UTC `now`, the briefing with a NaN
sector, and grep prompt.ts for "목표가"/"peak/trough average".
