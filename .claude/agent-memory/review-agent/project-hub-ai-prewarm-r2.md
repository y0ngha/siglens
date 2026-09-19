---
name: project-hub-ai-prewarm-r2
description: feat/hub-ai-prewarm round 2 — runHubPrewarm wired into runPrewarmBatch without updating 3 sibling test files' mocks; batchDeadline computed before hub phase erodes symbol budget despite a comment claiming otherwise
metadata:
  type: project
---

Worktree `siglens-wt-hubwarm`, branch `feat/hub-ai-prewarm`. Round 1 fixed 3 required findings
(readBackWithRetry, per-target unit timeout, providerFallback) — all verified correct in round 2 via
static trace + reading `hubs.test.ts`'s 4 new tests (retry-recovers, retry-exhausted-but-tag-fires,
unit-timeout via fake timers, providerFallback assertion). All four are genuinely falsifiable
(reverting the corresponding line breaks exactly the predicted assertion) — verified by tracing, not
by executing revert-mutations (constraint: never call a DB/LLM provider in this worktree, so I did
not run `runPrewarmBatch.test.ts` — see next paragraph for why that specific restraint mattered).

## Round 2 — 2 new required findings

**1. `runHubPrewarm()` wired into `runPrewarmBatch()` (runPrewarmBatch.ts:313) without updating the
3 pre-existing sibling test files that already call `runPrewarmBatch()`** (`runPrewarmBatch.test.ts`
56 call sites, `.inflightMarkerIntegration.test.ts` 1, `.structuralUnavailable.test.ts` 5 — 62 total).
None of the three mock `./hubs`, so every one of those tests now executes the *real* hub-prewarm path:
real `@y0ngha/siglens-core` `runBriefing`/`runMacroBriefing`/`runMarketNewsDigest` (LLM calls), real
`getCachedMarketSummary`/`getEconomySnapshot` (Upstash Redis via `@upstash/redis`, HTTP/fetch-based).
This is currently caught *by accident*: `vitest.setup.base.ts` globally stubs `globalThis.fetch` to
always reject (`Object.defineProperty`, survives `restoreAllMocks`), and both `@upstash/redis` and the
`@anthropic-ai/sdk`/`openai` packages this repo depends on default to `globalThis.fetch` — so the real
calls fail fast instead of reaching production. But that's an unrelated layer's safety net, not an
intentional contract for this new coupling — this is exactly MISTAKES.md §8.6 ("global mocks in
vitest.setup.base.ts hide unintended missing dependencies; tests pass despite modules not declaring
the mocked package"). Concretely, independent of the network question: `[hub-prewarm]` is not in
`vitest.setup.base.ts`'s `expectedConsolePrefixes` allowlist, so every one of those ~62 test
invocations that doesn't locally spy on console (most don't) now prints unsuppressed
`console.error('[hub-prewarm] failed: ...')`/`console.warn` noise — a real, guaranteed regression to
test-output signal quality, not just a hypothetical risk. Fix: `vi.mock('../hubs', () => ({
runHubPrewarm: vi.fn().mockResolvedValue({ attempted: 0, generated: 0, keyMismatch: 0, failed: 0,
skippedByDeadline: 0 }) }))` in all three files.

**2. `HUB_DEADLINE_MS` doc comment ("심볼 배치(10분)의 예산을 잠식하지 않는다" — "does not erode the
symbol batch's 10-min budget") is factually wrong given the code.** `batchDeadline =
clock.now() + BATCH_DEADLINE_MS` is computed as the *first* line of `runPrewarmBatch`, before
`await runHubPrewarm(...)`. Since `isPastDeadline` compares against this fixed absolute timestamp,
any wall-clock time the hub phase consumes (up to ~120s via `HUB_DEADLINE_MS`'s between-target check,
plus up to one more `HUB_UNIT_TIMEOUT_MS`=45s if a target was already in flight when the check fires
— so up to ~165s worst case, not `45s×9`) is subtracted from the symbol loop's real remaining budget
before it starts. The claim in the comment is backwards. Functionally this is *not* catastrophic — the
harder invariant (`BATCH_DEADLINE_MS` staying under `LOCK_TTL_SECONDS`=900s so two cron ticks never
overlap) still holds, and the *old* rotation-window invariant this would have threatened
(`BATCH_DEADLINE_MS + schedule period ≤ window width`) was already killed off by the 2026-08
Redis-cursor fix (`runPrewarmBatch.ts`'s own extensive doc-comments on `advanceRotationCursor` say so
explicitly) — so eroding the symbol budget by ~165s/600s doesn't reopen the KR-starvation bug. But the
comment's specific claim is still false, in a file that otherwise treats timing-invariant comments as
load-bearing incident history. Recommended-severity sibling: the new spec doc
(`docs/superpowers/specs/2026-09-18-hub-ai-prewarm-design.md:30-31`) justifies the 120s cap by citing
that same now-dead rotation invariant — stale reasoning inherited into a brand-new doc.

## Non-finding (verified, not flagged)

Checked whether `HUB_UNIT_TIMEOUT_MS`'s losing `Promise.race` branch (`target.run()`, when the
20real call eventually settles after timeout) risks an `unhandledRejection` crash. It doesn't:
`Promise.race` attaches `.then(resolve, reject)` to *every* operand at call time (not just the
winner), per spec — so the loser's eventual rejection is handled (as a no-op after the race already
settled), never surfaces as an unhandled rejection. Same protection already covers the pre-existing
`TAB_SEAMS(...)` race in `processSymbol` (`runPrewarmBatch.ts`). Not a new risk.

Also checked (and cleared) a `src/app/**` deep-import concern: `hubs.ts` imports
`@/entities/market-news/lib/toEnrichedMarketNewsItem` and `.../lib/marketNewsConstants` directly,
bypassing the `market-news` barrel (neither symbol is re-exported by `index.ts`). Initially looked like
a barrel-only violation, but `.oxlintrc.json`'s `src/app/**` override deliberately excludes the
barrel-only `no-restricted-imports` pattern ("RSC page/route handler는 server-only 내부 구현 접근이
필요해 deep import 제외") — CLAUDE.md's condensed prose rule doesn't spell out this app-layer carve-out,
only `.oxlintrc.json` does. Always check the actual oxlint override, not just CLAUDE.md's summary,
before flagging an app-layer deep import.

See [[rules-conventions]], [[rules-ff]], and [[project-seo-prewarm-rotation-mutation-verify]] (sibling
file in the same cron directory, prior audit).

## Round 3 — both round-2 required findings fixed correctly; 1 new required finding (self-inflicted by the fix)

Verified: all 3 sibling files got the identical `vi.mock('../hubs', …)` block (zeroed
`HubPrewarmResult`, comment naming MISTAKES.md §8.6) — grepped for stray "hub" mentions in those 3
files and found none outside the mock, confirming the hub phase truly is new there (no prior
assertion got silently hidden by the mock). `batchDeadline` now computed *after* `await
runHubPrewarm(...)` (`runPrewarmBatch.ts:320-327`), so `BATCH_DEADLINE_MS`=600s really is the
symbol loop's budget again. Re-verified the 765s arithmetic against actual constants
(`hubs.ts`: `HUB_DEADLINE_MS`=120_000, `HUB_UNIT_TIMEOUT_MS`=45_000; `lock.ts`:
`LOCK_TTL_SECONDS`=900) and against `runHubPrewarm`'s actual loop structure (deadline check runs
*before* starting each target, so the last target can start just under the 120s mark and then run
up to 45s more) — 165+600=765<900 holds exactly as claimed. Full scoped suite green (111/111,
`yarn test run runPrewarmBatch hubs.test`).

**New required finding**: moving `batchDeadline` to after the hub phase silently broke
`counts.durationMs` (`runPrewarmBatch.ts:449`,
`clock.now() - (batchDeadline - BATCH_DEADLINE_MS)`). That expression anchors on whatever
`clock.now()` was *when `batchDeadline` was set* — in round 2 that was the first line of the
function (so `durationMs` = full function duration, hub included), but in round 3 it's now
right after the hub phase finishes, so `durationMs` measures the symbol-loop only and silently
excludes up to ~165s of hub-phase wall-clock. `PrewarmBatchCounts`'s own JSDoc
(`runPrewarmBatch.ts:34-41`, untouched this round) says this field exists specifically to catch
"배치가 tick 주기(5분)를 넘기면" lock-delay erosion and calls it "그 구간을 보는 유일한 창" (the
only window into that problem) — but the lock is now held for hub+symbol combined (per this
round's own new comment at line ~301-309), while the metric only reflects the symbol portion. No
test caught this: the one assertion on it (`runPrewarmBatch.test.ts` "Task 7", ~line 1394) only
checks `toBeGreaterThan(0)`, and since these tests mock `../hubs` to resolve instantly, the hub
phase never consumes simulated clock time in tests either way — the regression is invisible to
the suite by construction, only reachable by reasoning about production timing. Root cause:
`batchDeadline` was serving two unrelated purposes (symbol-loop deadline anchor + durationMs
baseline) and fixing one silently moved the other (FF 4-A one-responsibility coupling). Correct
fix is a separate `const batchStartedAt = clock.now()` captured before the hub phase, independent
of where `batchDeadline` gets computed.

## Round 4 — closed

Fixed correctly: `const batchStartedAt = clock.now()` captured as the first line of
`runPrewarmBatch`, before the hub phase, independent of `batchDeadline` (which stays
computed after the hub phase for the budget-erosion reason from round 3). `durationMs =
clock.now() - batchStartedAt` now spans hub+symbol combined, matching the lock's real
hold time and the field's own JSDoc contract. New regression test
(`durationMs는 허브 단계에 쓴 시간까지 포함한다`) makes `runHubPrewarm` consume simulated
clock time via `clock.sleep()` inside the mock and asserts `toBe(totalElapsedMs)` (not a
weaker `>=`) — traced by hand that the sim-clock's per-unit-timeout `Promise.race` arm
also advances `t` synchronously on invocation (losing arm still runs its body up to the
first `await`), so `totalElapsedMs` ends up 210000 (90000 hub + 120000 unit-timeout arm)
matching the reported revert failure (`expected 120000 to be 210000`). Scoped test run
green (51/51), scoped tsc clean, no leftover `batchDeadline - BATCH_DEADLINE_MS` string
anywhere in the directory. Approved, no new findings. Epic closed after 4 rounds.
