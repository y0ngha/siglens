---
name: project-agent-precomputed-data-r4
description: feat/agent-precomputed-data R4 (2026-09-19) — all R3 required fixes mutation-verified; only recommended left (wrong getQuote-failure contract in quoteTimeout JSDoc, localDate duplicates marketSessionDate helper, orphaned rounding comment)
metadata:
  type: project
---

R4 of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, uncommitted). Result: changes_requested, recommended only.

Killed by mutation in a scratch rsync copy (all confirmed): MessageList `{ px }` → bare number (the 2-send test fails);
route.ts `quoteWithTimeout` → raw getQuote (5s timeout test fails); snapshot and history branches `isStaleByBars` → `stale()`
(each has its own failing test); getMyPortfolio and priceNowFor timeouts. tsc (TS 7 native, about 2s) 0 errors, oxlint 0,
47 files / 734 tests green. `oxfmt --check` flags 13 files, but the pre-commit lint-staged hook runs `oxfmt` in write mode,
so that is not a finding.

Recommended findings:
- `shared/api/market/quoteTimeout.ts` JSDoc says a failed quote is represented as `0`, not `null` or a throw. That is false:
  the core `MarketDataProvider.getQuote` port says `null` when unavailable, and both FMP and Yahoo catch and return `null`.
  The `price: 0` sentinel only exists in market-summary sector rows. getMyPortfolio.ts and getCachedAnalysis.ts repeat the claim.
- `localDate.ts` copies `marketSessionDate.ts`'s private `formatterFor` + `zonedParts(...).date` almost line for line
  (kstDateKey is a third fixed-zone copy of the same idea).
- In getBarsIndicators, the "Client-serialization-boundary rounding" comment sits above `confluenceView`, 8 lines from the
  `roundIndicators` call. It was already 1 line off on master; the branch widened the gap.

**How to apply:** if R5 happens, check only these three. The R3 fixes are closed.
See [[project-agent-precomputed-data-r3]].
