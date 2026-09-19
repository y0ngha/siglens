---
name: project-agent-precomputed-data-r6
description: feat/agent-precomputed-data R6 (2026-09-19) — R5 fixes verified closed; one recommended comment nit (fundamentals quote comment says "bounded like every other agent-tool quote" but get_quote is raw)
metadata:
  type: project
---

R6 of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, uncommitted). 3 modified files.

Verified closed:
- `marketSessionDate.ts`: order is now zonedParts → zoneOffsetMs (own JSDoc) → zonedDate (own JSDoc) → zonedWallClockToUtc.
- `getFundamentals.ts`: the quote goes through `quoteWithTimeout(getCachedMarketDataProvider(session), fmpSymbol ?? symbol)`,
  and `session` is computed once. The never-settling-quote test holds up on reasoning: fake-timers `tickAsync` first yields
  a real macrotask, so the async chain registers the 5s timer before the advance. Without the race, allSettled never
  resolves, so the test would time out.
- 4 scoped files / 110 tests green, tsc 0, oxlint 0.

Non-issue checked: moving `resolveMarketProfile` BEFORE the fan-out is not a latency regression. Master ran it serially
AFTER the fan-out, and it calls getAssetInfo internally anyway.

Recommended only: the comment above the quote (about line 135) says "bounded like every other agent-tool quote" and
"price only feeds targetUpsidePct". get_quote still calls getQuote raw (exempt, because the quote is its payload), and
`price` is also returned top-level.

**How to apply:** when a fix adds a justification comment about sibling behavior ("like every other X"), grep the
siblings. See [[project-agent-precomputed-data-r5]].
