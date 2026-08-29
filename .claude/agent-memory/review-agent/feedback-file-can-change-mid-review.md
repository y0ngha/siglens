---
name: feedback-file-can-change-mid-review
description: Files under review can be edited by the implementer while review-agent is still reading them in the same round — verify freshness before trusting earlier reads
metadata:
  type: feedback
---

During `worktree-seo-internal-links-dead-symbols` round 1, `src/shared/config/relatedSymbols.ts`
was rewritten (THEME_PEERS → THEME_PEER_GROUPS + round-robin `themePeersOf`, +CROSS_MARKET_THEME_GROUPS)
**after** I had already fully read it and run its test file — `stat -f "%Sm"` showed the source file's
mtime was later than every sibling file in the diff, including its own test file that predated it by ~5min.
An analysis based on the earlier read (including a "push-mutation" and arithmetic finding) would have
targeted code that no longer existed.

**Why:** The implementer/orchestrator can still be iterating on a worktree while review-agent is mid-session
reading files — there is no lock. A single upfront `git diff --name-only` + one Read pass is not
sufficient for long review sessions that also run `git show master:<path>` diffs and scoped test runs,
since real time passes between the first read and the final report.

**How to apply:** Before finalizing findings that hinge on exact line content of a file already read earlier
in the session (especially files under active same-session iteration, or sessions with many tool calls),
re-check freshness with `stat -f "%Sm" <file>` (or compare against sibling files' mtimes) and re-read via
`cat -n` if the file is newer than when it was first read. Always re-run the actual test suite as the final
step before reporting — a stale "tests passed" claim from an earlier tool call in the same session can no
longer be trusted once you know the underlying file changed after that run.
