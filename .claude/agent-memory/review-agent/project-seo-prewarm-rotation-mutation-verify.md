---
name: project-seo-prewarm-rotation-mutation-verify
description: audit/fix-prewarm branch — seo-prewarm rotation-cursor fix; round-2 verified via live mutation testing, approved
metadata:
  type: project
---

Branch `audit/fix-prewarm` (worktree `siglens-fix-prewarm`) fixes a KR-symbols-never-selected
starvation bug in `src/app/api/cron/seo-prewarm/`. Root cause: the prewarm rotation offset used
to derive from wall-clock (`floor(now / TICK_ROTATION_MS) * SYMBOLS_PER_TICK`), so a delayed
batch caused the offset to jump past a window instead of walking — that window (KR block, head
of `POPULAR_TICKERS`) could go unselected indefinitely. Fix: offset now comes from a Redis
absolute counter (`advanceRotationCursor` in `lock.ts`) that advances by `SYMBOLS_PER_TICK`
exactly once per actual execution — tied to "execution count," not elapsed time or completion
count (a third design was tried and reverted for each of those — see doc-comments on
`advanceRotationCursor` and `selectFairBatch` in `runPrewarmBatch.ts` for the full incident
history, all three failure modes are documented in-code).

## Round 2 — what was actually verified (not just claimed)

The round-2 diff added one test (`runPrewarmBatch.test.ts`, "동적 배열 회귀 가드") that runs a
3-night × 15-half-hour-tick simulation (`vi.setSystemTime` over real 2026-08-17..19 dates) against
a 25-symbol universe (5 KR head + 20 US), asserting per-tick selection against a shadow-model
oracle (`predictBatch`) that reimplements *only* the rotation arithmetic (`offset = base %
length`, slice 6) — freshness/defer decisions are NOT reimplemented, they call the real
`isSnapshotFresh`/`snapshotCloseBoundaryFor`/`shouldDeferPrewarmWhileOpen` from
`@/entities/seo-snapshot/lib/freshness` (not mocked in this file).

I independently re-ran the exact "stale-length" mutation the author described (cached
`staleSymbols.length` in a `globalThis` var instead of recomputing per call) both full-suite
(4 tests failed, cross-contaminated via the shared module-level cache — confirms the author's
"leaked across tests" report) and isolated via `-t` (single test still fails, at night 2, for the
right reason — confirms it's not order-dependent luck). Also mutated the two rewritten deadline
tests' targets directly: removed the chunk-level `isPastDeadline()` check (chunk-entry test fails,
ordering test unaffected), removed the tab-level check (ordering test fails, chunk-entry test
unaffected), and swapped the alreadyFresh/isPastDeadline check order (ordering test fails with the
exact predicted wrong-order remaining=2). All four targeted mutations produced exactly the
predicted failure, confirming the tests bite for the right reason and aren't circular/tautological.
Also verified the `lock.ts` `advanceRotationCursor` comment's fail-hard propagation claims against
`route.ts`'s try/catch/finally and `selectFairBatch`'s `Promise.all` (accurate — no per-candidate
isolation exists yet, matches comment).

Reused all mutations in-place then reverted (`git diff --stat` matched exactly before/after) —
this is a safe verification pattern for review rounds where the author reports mutation-testing
results: don't just trust the report, re-run it, since it's cheap (single file, `yarn test <path>`)
and catches both false claims and (as here) confirms true ones with much higher confidence than
reading the test code alone.

One non-finding worth remembering: KRX has **no holiday calendar** in this codebase at all
(`src/shared/lib/marketSessionDate.ts` comment: "KRX는 미보유") — only NYSE does (via siglens-core's
rule calendar). So `shouldDeferPrewarmWhileOpen` (which only checks weekday+time via
`isRegularSessionOpen`) can never be affected by a KR holiday, and even for the nightly-reset
boundary calc, a real KR holiday on the test's chosen dates wouldn't cause oracle/actual
divergence (both call the same real function) — so the "are the test dates holiday-free" question
is close to moot for this specific test's correctness, only relevant to the accuracy of an inline
comment. Aug 17-19, 2026 happens to include a likely Korean 대체공휴일 (Liberation Day, Aug 15
2026, falls on Saturday) but this has zero functional effect here.

See [[rules-conventions]] and [[rules-ff]] for the baseline checklists this review still applies
on top of.
