---
name: project-agent-precomputed-data-r1
description: feat/agent-precomputed-data R1 (2026-09-19) — agent tool derived fields + chat scroll + skills rewrite; 7 required findings incl. UTC-midnight staleness, Fib label decimals, dead 1Day HTF
metadata:
  type: project
---

Round 1 review of `feat/agent-precomputed-data` (worktree `siglens-wt-computed`, base v0.80.2 — origin/master had moved on, so `git diff origin/master` showed unrelated hub-prewarm deletions; review `git diff HEAD` + untracked instead). Returned changes_requested.

Facts that non-obvious findings rested on (all verified live, re-check if code moved):
- FMP daily bars are stamped at UTC midnight of the trading date (`toFmpDailyBar`) = 20:00 ET the previous day. Any "count bars with time > generatedAt" staleness rule misses the next US session for analyses generated 20:00 ET → next close (KST daytime = ET night, the main user base).
- core `formatFibRatio` renders ONE decimal: `Fib 50.0%`, `Fib ext 100.0%`, `Fib ABC ext 200.0%`. Skills citing `Fib 50%` / `Fib ABC ext 100%` do not match the rendered label.
- core `TIMEFRAME_BARS_LIMIT['1Day']=500` → `aggregateBarsToWeekly` gives ~101 weeks < `CONFLUENCE_MIN_BARS` 120, so any weekly `evaluateConfluence` is always null in prod; a 900-bar test fixture hides it.
- core level-distance convention is `(level − price)/price` (referenceLevels, options distancePct); siglens `pctVs(priceNow, level)` inverts sign and base.
- `daysUntil`-style `Math.round((YYYY-MM-DD@00Z − now)/day)` is off by one during the US session (returns 0 the day before, −1 on the day).

**Why:** these are the traps a later round will need to re-verify quickly.
**How to apply:** on R2, re-check each against the fix; for new "days to X" / "bars since X" code, test with a now inside the US session and an ET-evening generatedAt, not UTC midnight. See [[feedback-audit-enumerate-slice-not-difflist]].
