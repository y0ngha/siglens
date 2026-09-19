---
name: project-agent-precomputed-data-r3
description: feat/agent-precomputed-data R3 (2026-09-19) — R2 frozen-clock fixes correct inside the describe block, but 2 real-clock snapshot/history staleness tests fail 01:00–04:00Z; MessageList `{ px }` wrapper untested
metadata:
  type: project
---

R3 of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, uncommitted). Result: changes_requested.

Verified by mutation in a scratch rsync copy (node_modules symlinked, `./node_modules/.bin/vitest` with
`NODE_OPTIONS=--no-experimental-webstorage` — works for siglens too, deleted afterwards):
- `getCachedAnalysis.test.ts` "technical snapshot (round 6 item 9)" + "history (round 6 item 9)" sit OUTSIDE
  the frozen `bar 기반 staleness` describe, use `Date.now() - 2d` and a bar at `generatedAt - 3600`. Under the
  ET trading-date rule that bar lands on the NEXT UTC date whenever the run is at 01:00–04:00Z (10–13 KST) →
  `stale: true`, test fails. Reproduced at 02:00Z/03:30Z; passes at 00:30Z/12:00Z. Root: non-UTC-midnight
  daily-bar fixture + real clock.
- MessageList `activeMinHeight: { px }` object exists so equal-clientHeight consecutive sends re-trigger the
  layout effect. Reverting to bare `number` passes all 14 existing tests; only a 2-send scratch test fails.
- Ordering test (scroll after min-height commit) IS guarded — moving scroll into the detection effect fails it.

Also flagged: orphaned JSDoc from inserting a new doc/helper between an old JSDoc and its function (3x:
priceNowFor, tallyOf, sectorBreadth); stale "two state updates" comment; stale "parallel with
positionBucketFor" JSDoc; "round N item N" tags (master has zero in src/, branch adds 17 non-test).

**Why:** the "every staleness test freezes the clock" claim only covered the describe block the finding named.
**How to apply:** for time-rule fixes, grep the WHOLE test file for `Date.now()`/`new Date()` near staleness
assertions, not just the block cited; for "wrapped in object so it re-renders" fixes, demand a repeat-value test.
See [[project-agent-precomputed-data-r2]], [[feedback-audit-enumerate-slice-not-difflist]].
