---
name: mutation-test-via-git-show-not-stash
description: How to verify test falsifiability (revert fix, confirm test fails, restore) without git stash noise
metadata:
  type: feedback
---

When a task requires proving each new test is falsifiable (revert the fix it covers,
confirm the test fails, then restore), use `cp` to a scratchpad backup + `git show
HEAD:<path> > <path>` to mutate a single file back to its pre-fix content, run the
scoped test, then `cp` the backup back over the file to restore.

**Why:** `git stash push -- <file>` on individual files inside a change that touches
many files is messy to reason about and risks stashing unrelated hunks or leaving the
worktree in a confusing partial state across multiple sequential mutations (one per
finding). The `cp`-backup + `git show HEAD:<path>` approach mutates exactly one file
at a time, is trivially reversible, and composes cleanly when doing this for N
independent findings in the same PR (temporarily revert file A, test, restore A;
then file B, test, restore B; ...).

**How to apply:** For each finding/fix that has a dedicated regression test:
1. `cp <file> <scratchpad>/backup/<name>` (or capture just the touched fix if you want
   to isolate one guard among several in the same file, edit that guard back manually
   instead of a full revert).
2. `git show HEAD:<path> > <path>` (or manual Edit for an isolated single-guard mutation).
3. Run only the scoped test file(s) for that finding, capture the exact failure count
   and test names.
4. `cp <scratchpad backup> <file>` to restore, then re-run the scoped tests to confirm
   green again before moving to the next finding.

Report each mutation's failure count explicitly (e.g. "4/4 new tests failed", "1/15
failed — exactly the dedicated guard test") rather than just "tests failed as expected"
— the exact count is what proves the test is pinned to the right code path and not a
false positive from an unrelated regression.

See also: this pattern paired well with isolating one guard at a time within the same
file (e.g. the ETF-financials guard vs. the isKr-options guard both live in
`buildPopularEntries.ts`) by reverting each guard individually via `Edit` instead of a
whole-file `git show`, to get per-guard failure counts instead of one combined count.

**Multi-file threading changes (one fix, many call sites updated to compile):** when a
fix changes a shared function's signature/contract and that forces 10+ downstream call
sites to be touched just to keep them compiling (e.g. adding a required `marketProfile`
prop to a shared component, which then has to be threaded through 7 renderer components
and their callers), don't revert all 30+ touched files to prove falsifiability — revert
only the 1-2 "core" files that hold the actual logic (e.g. the component/function whose
behavior changed), leaving every downstream caller as-is. Passing an extra/now-unused
prop to a reverted component is harmless at runtime (React ignores it; TS excess-property
checks on JSX don't block `vitest`'s esbuild-only transform, which doesn't type-check).
Run the full test scope with just the core file(s) reverted — every test that pins the new
behavior should fail, every pre-existing test should stay green, with zero collateral
failures. This was confirmed in siglens PR (SEO audit item 3, 2026-08-18): reverting just
`formatSnapshotAsOf.ts` + `SnapshotSummarySection.tsx` (not the 7 renderer files or ~10
page callers that also changed) produced exactly 16/16 new-test failures and 0 collateral
failures across 9 test files.

**Caveat — uncommitted prior work in the file:** if the target file already has
substantial *uncommitted* changes at the start of the session (common when dispatched
into a long-lived feature worktree), `git show HEAD:<path>` reverts past those too, not
just the fix under test — you'd be testing against a stale HEAD state the reviewer
never saw. In that situation, use `cp <file> <scratchpad>/orig` at session start (before
any of your own edits) as the restore point instead of `git show HEAD:`, and diff
against that backup (not `git diff`, which compares to HEAD and will show your whole
session's target function as "new" even though you only touched one paragraph/line).
