---
name: check-untracked-files-round1
description: Round-1 review procedure gap — git diff --name-only against origin/master silently omits new untracked files in a worktree
metadata:
  type: feedback
---

`git diff {base} --name-only` (the mandated Round-1 file-discovery command) only shows tracked
changes — it never lists untracked (`??` in `git status`) files. In a worktree-based implementer
workflow, a brand-new file that hasn't been `git add`ed yet (e.g. a new `__tests__/Foo.test.tsx`
added alongside a component fix) is invisible to this command and gets silently skipped.

**Why:** Caught on `audit/fix-currency` — `PositionCta.tsx` was modified to add symbol-derived
currency, but its test file `PositionCta.test.tsx` was a wholly new, untracked file. It didn't
appear in `git diff origin/master --name-only`, so the standard Round-1 procedure would have
reviewed the implementation change without ever reading the test that was supposed to cover it.
Found by cross-checking `git status --porcelain=v1 -uall | grep '^??'` after the name-only diff
felt incomplete relative to the task's own file list.

**How to apply:** In Round 1, after `git diff {base} --name-only`, always also run
`git status --porcelain=v1 -uall` and fold any `??` entries under the same directories/slices
being reviewed into the review scope. Do not rely on `--name-only` alone to enumerate "files
changed" when reviewing a worktree that may contain uncommitted new files.
