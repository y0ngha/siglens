---
name: shadow-model-oracle-for-stateful-rotation-tests
description: How to test a persisted-cursor rotation/offset algorithm against a dynamically changing candidate array without reimplementing the whole SUT
metadata:
  type: reference
---

When a review asks for a regression test pinning a rotation/offset invariant
(`offset = base % array.length`, persisted cursor across calls) under an array whose
**length and membership actually change** between calls — not the usual static-array
tests that only vary the cursor — reimplementing the domain logic by hand to predict
exact expected output is risky (easy to get subtly wrong, and aggregate "coverage"
assertions on a loose tick budget often fail to be mutation-sensitive at all: a broken
scheme can still achieve full coverage "by luck" once nothing is ever blocked, because
completed items naturally drop out of the array regardless of the offset math).

**The fix: a shadow-model/oracle, not a full reimplementation.**
1. Reuse the SUT's real domain functions for every decision *except* the offset
   arithmetic under test (e.g. real freshness/session-boundary/defer functions — don't
   mock them, they're not what's being verified).
2. Reimplement only the trivial rotation math (a few lines: `offset = base %
   selectable.length`, then slice) as the oracle's `predictBatch`.
3. Capture the **actual** `base` the SUT used that tick (e.g. by wrapping the mocked
   cursor function to record what it returned) rather than recomputing it — you want to
   check "given this base and this tick's real selectable array, did the SUT pick the
   right slice", not re-derive the cursor's own progression too.
4. Assert `actual === predicted` on every single tick (exact array equality, order
   included — order-preserving `Promise.all` behavior over identically-shaped mocked
   promises is already relied on elsewhere in this codebase for exact-order assertions).

This makes the test **mutation-sensitive regardless of tick budget** — a captured-stale-
length bug or a cursor-reset bug diverges from the oracle on the very first affected
tick, whereas a coverage-only assertion needs a razor-tight, hand-tuned tick budget to
catch the same bugs (and is still fragile/easy to get wrong).

**Caveat found during verification:** a "captured stale length" mutation implemented as
a naive persistent module-level variable (`let cached = cached ?? current`) leaks across
*all* tests in the file (poisons whichever test runs next with its own array length),
producing collateral failures unrelated to the property under test. Confirm real
positives by running the target test with `-t` in isolation (clean signal) and then
separately running previously-passing tests alone (not the whole file) under the same
mutation — if they only fail when run after other tests, that's mutation-injection
leakage, not evidence those tests independently pin the axis. See
[[feedback_mutation_test_collateral_failures]] for the general pattern.

**How to apply:** any time a review asks to pin a stateful/persisted counter's
interaction with a candidate pool whose size changes for domain reasons (items complete
and drop out, a scheduling boundary resets the pool, a sub-group is temporarily excluded
and later reincluded) — build the oracle around the real domain functions, not a
hand-modeled calendar/session substitute; if the real functions are already unit-tested
elsewhere in the slice, reusing them here is safe and avoids inventing a second,
possibly-wrong model of the same domain rules.
