---
name: project-agent-precomputed-data-r5
description: feat/agent-precomputed-data R5 (2026-09-19) — R4 wording/dedup fixes landed, but zonedDate was inserted between zoneOffsetMs and its JSDoc; getFundamentals' branch-new quote bypasses quoteWithTimeout
metadata:
  type: project
---

R5 of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, uncommitted). Result: changes_requested, recommended only.

Verified closed: the quote-failure wording is right in all 4 files, `localDate.ts` is gone (0 references left),
and the rounding comment now sits directly above `latestIndicators(roundIndicators(...))`.
6 scoped files / 142 tests green, tsc 0, oxlint 0.

New recommended findings:
- `marketSessionDate.ts` about line 85: the new `zonedDate` block was pasted BETWEEN `zoneOffsetMs`'s one-line JSDoc
  and `zoneOffsetMs`. That orphans the offset doc onto `zonedDate`, and `zoneOffsetMs` now has no doc.
  This is the same "edit displaces an adjacent comment" pattern R4 flagged in getBarsIndicators.
- `getFundamentals.ts` about line 134: the branch ADDED a quote (master had none) through a raw
  `getCachedMarketDataProvider(...).getQuote(...)` inside the allSettled fan-out, not through `quoteWithTimeout`.
  The quote only feeds `price`/`targetUpsidePct`, so it is pure enrichment. The fundamental calls are Redis-cached
  (CachedFundamentalProvider), so this uncached-on-miss quote is the likely long pole during an FMP 429 storm (about 85s).
  This contradicts quoteTimeout's own JSDoc ("every consumer that needs a quote, or give up soon (agent-chat tools...)").
  The get_quote tool's raw getQuote is its primary payload, so it is arguably exempt.

**How to apply:** when a fix-round "moves a helper into file X", diff the insertion point for a displaced comment.
When a branch introduces a shared bound helper, grep the raw call (`.getQuote(`) repo-wide for new, unbounded sibling
callers ([[feedback-audit-enumerate-slice-not-difflist]]). See [[project-agent-precomputed-data-r4]].
