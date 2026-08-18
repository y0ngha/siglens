---
name: read-tool-silent-line-loss
description: A full-file Read (no offset/limit) can silently return fewer lines than the file actually has, with no truncation warning — verify with wc -l before trusting "this content is missing"
metadata:
  type: feedback
---

On a large (~500-line), Korean-comment-heavy `.tsx`/`.test.ts` file, calling `Read` with no
`offset`/`limit` returned a version of the file missing a ~12-line paragraph (in one file) and a
~6-line block containing two `expect()` assertions (in a test file) — with the tool's own
line-number footer silently re-numbering everything after the gap, so nothing looked truncated.
The gap was only caught because a later `git diff {base} -- <file>` hunk showed context lines that
didn't match what had just been read.

**Why:** During `audit/fix-r4` round-1 review, this caused a near-miss: the initial read of
`overall/__tests__/page.test.ts` (which actually has 446 lines but rendered as if it ended at 440)
dropped the two lines `expect(mockPeekOverall).not.toHaveBeenCalled()` and
`expect(mockPeekOverall).toHaveBeenCalledTimes(1)` from two test cases the task explicitly asked
to judge ("are mutations (b)/(c) decoration?"). Without those two assertions the tests looked like
pure duplicates of an existing "returns normal metadata" test and would have been wrongly flagged
as decorative/redundant — a false review finding caused entirely by the read gap, not the code.

**How to apply:** For any file over ~300-400 lines (especially with heavy non-ASCII/Korean prose),
cross-check `wc -l <file>` against the last line number the Read tool reported. If they don't
match, re-read the missing range with an explicit `offset`/`limit` before drawing conclusions —
never treat a full-file Read as authoritative on its own for files in this size class, and never
conclude "this assertion/paragraph is missing" without that cross-check. This is a different
failure mode from the documented 2000-line/token-cap truncation (which announces itself); this one
does not.
