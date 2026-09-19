---
name: project-agent-precomputed-data-r2
description: feat/agent-precomputed-data R2 (2026-09-19) — R1 logic fixes correct, but the new timezone/staleness tests are vacuous or time-bombed (fixed dates vs 7-day hard cap; test instants where local date == UTC date)
metadata:
  type: project
---

R2 of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, uncommitted). Result: changes_requested.
All 7 R1 required fixes were correct in source (trading-date staleness, distancePct sign, close>0,
market-tz daysUntil, eslint-disable gone, trailing SMA50, Fib labels match core `formatFibRatio`).

Defects were all in the TESTS guarding those fixes (each confirmed by mutation in a scratch copy):
- `getCachedAnalysis.test.ts` uses fixed `generatedAt` dates with the real clock. `isStaleByBars`
  returns `true` first when age > 7 days, so `2026-09-10` tests ("threshold 1", "overall bar staleness")
  already pass via the hard cap — swapping overall's `isStaleByBars` for the age rule survives. The KR
  "not stale" test (`2026-09-17T15:30Z`) starts FAILING at 2026-09-24T15:30Z (reproduced by faking Date
  to 2026-09-25 in a scratch beforeEach).
- `daysUntil` tests use 18:00Z / 21:00Z / 00:30Z — at all three the ET/KST date equals the UTC date, so
  replacing `localDateOf(now, tz)` with the UTC date survives. The tool-level `earningsTimeZone` wiring is
  also untested (sessionSpecFor mock returns ET even for kr-equity).
- React Doctor (`--scope changed`) flags `react-hooks-js/set-state-in-effect` on the eslint-disable
  replacement in MessageList (warning, not blocking).

**Why:** a date-dependent fix is only guarded if the test instant sits in the window where the naive
version differs (US: 00:00–04:00Z; KR: 15:00–24:00Z) AND the clock is frozen below any hard cap.
**How to apply:** for any "calendar date in market tz" fix, check each test instant's local vs UTC date;
grep the test for `useFakeTimers`/`setSystemTime` near every hardcoded date compared against `Date.now()`.
See [[project-agent-precomputed-data-r1]], [[feedback-audit-enumerate-slice-not-difflist]].
