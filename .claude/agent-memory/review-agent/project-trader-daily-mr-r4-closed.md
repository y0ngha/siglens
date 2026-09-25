---
name: project-trader-daily-mr-r4-closed
description: siglens-trader feat/daily-mean-reversion R4 — both R3 recommended nits closed, approved
metadata:
  type: project
---

Round 4 of siglens-trader `feat/daily-mean-reversion`, worktree
`.claude/worktrees/daily-mr`. Only 3 modified files (`lib/db/queries.ts`,
`api/cron/execute.ts`, `api/cron/__tests__/execute.test.ts`) fixing R3's 2
recommended findings.

1. `hasTradeAuditCorrelation` JSDoc now reads `review-<ET date>-<symbol>`
   (fallback `review-<decisionId>`) — matches `api/cron/review.ts:128`
   (`d.symbol ? \`review-${etDate}-${d.symbol}\` : \`review-${d.id}\``)
   exactly, verified by grep.
2. `sold_today_query_failed` `mr_data_error` row is now pushed unconditionally
   when `getSymbolsSoldSince` throws, regardless of `notHeldOrExited.length`
   (moved the push above the candidate-gating branch). New test
   ("records the failure even with no entry candidates") sets up a watchlist
   of 1 symbol that is already held (so `notHeldOrExited` is empty) + query
   rejection, asserts `mr_data_error` row present and `decisionPhase`
   stays `undefined`. Ran `yarn vitest run` on both touched test files:
   184/184 green.

Closed after 3 rounds (R2 5-reviewer wave → R3 2 nits → R4 fix). See
[[project-trader-daily-mr-r3]] for R3 detail.
