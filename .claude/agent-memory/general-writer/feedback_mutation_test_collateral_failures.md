---
name: mutation-test-collateral-failures
description: When mutation-testing a fix, expect some unrelated existing tests to fail as a side effect if they assert on tightly-coupled internals (e.g. clock.now() call counts) — distinguish that from the fix's own regression tests failing.
metadata:
  type: feedback
---

When doing the required "revert the fix, confirm the new test fails, restore" mutation-testing step
(per the general-writer instructions), reverting a fix can cause *other, pre-existing* tests to fail
too if they were calibrated against call-order/call-count details that the fix's implementation also
touched (e.g. a test hardcoding "clock.now() is called exactly N times, in this order" to control a
mocked deadline check). This happened in `src/app/api/cron/seo-prewarm/runPrewarmBatch.ts`: removing a
`clock.now()` call from `selectFairBatch` (as part of switching rotation offset from wall-clock-derived
to a Redis-persisted cursor) shifted the call-count in two unrelated deadline-ordering tests by exactly
one, and reverting to the old code during mutation testing made those tests fail too — not because they
pin the behavior under fix, but because the mutation and the test calibration are coupled through shared
call-count bookkeeping.

**Why:** The instruction is to prove the *new* regression tests are falsifiable. A collateral failure in
an unrelated test during the same revert is expected and not itself a signal about the new tests — but
it must still be reported honestly (which test, why) rather than silently ignored, since the parent
agent/reviewer needs to know the mutation swept in a side effect.

**How to apply:** When reporting mutation-test results, separate "new tests that failed as intended" from
"pre-existing tests that failed as a side effect of the mutation touching shared call-count state" and
explain the latter briefly. Don't treat the collateral failure as a reason the mutation was invalid — the
real regression tests failing correctly is what matters.

See also: [[mutation-test-via-git-show-not-stash]] for the mechanical backup/restore procedure this
observation applies within.
