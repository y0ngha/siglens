---
name: project-analysis-plain-orphan-recovery-r1
description: fix/analysis-plain-orphan-recovery R1 — cache-write-inside-attempt() fix, verified exactly-once and correct; prewarm orphan-recovery benefit confirmed near-zero for 6 of 7 tabs
metadata:
  type: project
---

`fix/analysis-plain-orphan-recovery` (worktree `siglens-wt-cost-p3`), R1: approved with one recommended doc gap.

Fix: `writeCache()` moved inside `attempt()` (two success points: guard pass, salvage) instead of after `withDeadline`'s `Promise.race`, so a race-losing call still populates cache when it settles. `rewriteToPlainLanguage` gained optional `deadlineMs` (default 15s unchanged); `resolveHarvest` (seo-prewarm harvest.ts) passes 30_000.

Verified: exactly-once write (recursion doesn't double-write, retry branch never writes), no unhandled rejection (`.catch(()=>undefined)` on the fire-and-forget set), positional arg order at both call sites (`stream/route.ts` omits deadlineMs, `harvest.ts` passes 30_000 6th) is correct, tests use real fake-timer race scenarios (not vacuous — `advanceTimersByTimeAsync` + resolve-after-deadline + assert `cacheSet` call count), no stale JSDoc paragraphs describing old discard-without-caching behavior remain.

Confirmed the implementer's own suspicion: orphan-recovery cache write is real value only on the user SSE path. On the pre-warm path, 6 of 7 tabs (`overall/news/fundamental/financials/options/congress`) serve straight from the DB snapshot row (`repo.upsert({ plain, ... })`) afterward — client widgets that would call `rewriteToPlainLanguage` again don't mount once a snapshot exists (harvest.ts's own comment on the XOR gating, lines ~134-138). So a same-key cache read basically never recurs before the next night's regeneration changes the hash. Prewarm's actual gain from this PR is the longer 30s deadline reducing the raw miss rate, not the orphan-cache reuse. Current JSDoc doesn't say this is false, it just doesn't scope the claim — worth a one-line caveat if touched again, not blocking.

See [[project-plain-language-analysis-r3-closed]] for the feature's earlier rounds.
