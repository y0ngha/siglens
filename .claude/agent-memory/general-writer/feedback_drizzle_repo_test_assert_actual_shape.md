---
name: feedback-drizzle-repo-test-assert-actual-shape
description: When testing Drizzle repository methods (onConflictDoUpdate set, where conditions), assert the actual object/condition shape, not just call counts
metadata:
  type: feedback
---

For Drizzle-ORM repository tests with mocked `db.insert/update/select` chains (e.g. `src/entities/ticker/__tests__/api.test.ts`), prefer opening the real argument passed to `onConflictDoUpdate`/`where` and asserting on it directly, rather than asserting `toHaveBeenCalledTimes(N)`.

**Why:** A call-count assertion passes even when the underlying bug is present — e.g. "cron path must not overwrite `name` on conflict" can only be verified by reading `onConflictDoUpdate.mock.calls[0][0].set` and checking `toHaveProperty`/`not.toHaveProperty('name')`. This repo's `api.test.ts` already has two helpers built for exactly this (`collectColumnNames`, `collectSqlStrings`) that walk Drizzle's `queryChunks` tree to pull out real column names and bound values from a `where(...)` condition — reuse them instead of re-inventing a walker. Also: `toHaveBeenCalledWith({...exact object...})` (no `expect.objectContaining`) implicitly asserts the object has *no extra keys*, which is a cheap way to pin "conflict-update set must NOT include X" when X being present would otherwise silently pass a looser check.

**How to apply:** When adding tests to `entities/ticker/api.ts` (or any Drizzle repository following the same mock-chain pattern) for a conflict/branching behavior, write the test as a fake bug reintroduction check (flip the branch back to the old behavior locally, confirm the new test — and only that test — fails, then revert) before considering the test done. See [[feedback_implementer_scoped_gates]] for the scoped-gate rule this pairs with.
