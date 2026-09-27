---
name: project-fix-bot-analysis-parity-pr882
description: fix/bot-analysis-parity (PR #882, worktree siglens-bot-parity) R3 — removed bot concurrency multiplier + all bot_blocked UI/status across 6 analysis axes, renamed BotBlockedError→CacheOnlyMissError; approved
metadata:
  type: project
---

R3 of a multi-round bot-parity fix: (1) removed `BOT_STREAM_LIMIT_MULTIPLIER` —
`canAcceptAnalysisStream()` now takes no args, analysis-stream route no longer
imports/uses `isBot` for gating; (2) deleted `BotBlockedNotice` UI and the
`bot_blocked` status literal from all 6 analysis axes (technical/overall/
fundamental/financials/news/congress) — 5 of 6 now fall through `miss_no_trigger`
to the generic `unexpected` error (dead in practice since `skipEnqueueIfMiss`
is hardcoded `false` for those axes); only options-chain's `cacheOnly` path
still produces it, renamed to `CacheOnlyMissError`/`cache_miss` (renders `null`,
not an error); (3) removed the market/macro-briefing `botBlocked` rolling-deploy
compat shim from `MarketBriefingActionResult`.

Verified clean: grepped repo-wide for `BotBlockedError|bot_blocked|BotBlockedNotice|isBotBlocked`
— zero live references outside a historical-context comment in
`e2e/specs/analysis-jobs.spec.ts` describing the *old* behavior. All 4 i18n
locales (ko/en/ja/zh) + `clientKeys.json` dropped `BotBlockedNotice` keys in
sync. `tsc --noEmit` and `oxlint` both clean on re-run. Tests are
mutation-verified, not vacuous: each axis's branch-coverage test for
`miss_no_trigger` was rewritten to assert the *actual* fallback error message
(`koMessages.app.api.stream.unexpected`) rather than just a status string —
this is the correct pattern per [[feedback-never-assert-mock-calls-by-index]]-adjacent
concern (assert real derived values, not just that *a* status changed).

**Good example of MISTAKES.md #6.7** (rule applied consistently across sibling
call sites): the removal was applied identically to all 6 axes' hooks, widgets,
buildChatState comments, and tests — no axis was missed, confirmed by grep.

Approved — no findings across 3 rounds culminating here (R1/R2 not reviewed by
me directly, but R3 diff shows no regressions and no leftover dead code).
