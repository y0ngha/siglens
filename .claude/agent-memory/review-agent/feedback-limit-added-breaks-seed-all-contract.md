---
name: feedback-limit-added-breaks-seed-all-contract
description: When a branch adds a LIMIT/cap to a shared repository read, re-check every caller — a one-off "seed/backfill ALL" script silently becomes "first N", and the green gates say nothing
metadata:
  type: feedback
---

A `.limit(N)` added to a shared repository method for the benefit of one caller
(a request-path `waitUntil` scan) silently rewrites the contract of every other
caller. Backfill/seed scripts that document "analyze **all** rows" become
"analyze the first N" with no error, no log, and no failing test.

**Why:** on `feat/asset-class-navigation` R2, the branch added
`UNANALYZED_SCAN_LIMIT = 20` to `DrizzleEconomicCalendarRepository.listUnanalyzedAnnounced`
(absent at master) so a page-load `ensure` pass couldn't fire dozens of LLM
round-trips in one request. `scripts/seedEconomicEventAnalysis.ts` — whose header
says "One-time SEED script: analyze all current Medium+ announced unanalyzed rows"
— calls the same method. One run now seeds ≤20 per country and prints
`Seeding analysis for 20 … event(s)` / `Done — analyzed 20`, which reads as
"there were 20 and all 20 are done". KR's 180-day past window
(`CALENDAR_PAST_WINDOW_DAYS.KR`) makes >20 Medium+ announced rows near-certain on
the first run. tsc/lint/test/build were all green.

**How to apply:**
- Any diff that adds `.limit()`, `.take()`, a page size, or a `LIMIT` to a method
  that already had none: grep every caller and classify each as
  *streaming/incremental* (fine) vs *exhaustive* (broken). Scripts and cron
  backfills are almost always exhaustive.
- The tell is prose, not types: a header/JSDoc containing "all", "전부", "every",
  "one-time", "backfill" next to a now-capped query.
- Cheapest correct fix is a drain loop (`while (rows.length) { … }`), not raising
  the cap — the cap exists for the request path.

Pairs with [[feedback-scripts-excluded-from-tsc]] (same script, same branch, the
other half of the failure) and [[feedback-audit-enumerate-slice-not-difflist]].
