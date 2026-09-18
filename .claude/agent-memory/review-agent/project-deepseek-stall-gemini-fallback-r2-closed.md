---
name: project-deepseek-stall-gemini-fallback-r2-closed
description: siglens-core deepseek-stall-gemini-fallback R2 — all 4 R1 required findings verified fixed; new recommended gap in runMarketNewsDigest
metadata:
  type: project
---

R2 of feat/deepseek-stall-gemini-fallback (siglens-core worktree). All R1 required findings
verified fixed by reading the live source (not trusting the resolution text):

- `dispatch(model, ...)` bug: renamed inner param to `targetModel`; fallback path now really
  calls `dispatch(DEEPSEEK_FALLBACK_MODEL, fallbackKey)` — a live test ("JSON 재생성까지 합쳐도
  Gemini 호출은 최대 2번이다") pins DeepSeek fails twice + Gemini called exactly twice, which
  would fail under the old bug (DeepSeek would've been re-dispatched instead of Gemini).
- `roundsTo` epsilon: `FLOAT_NOISE_ULPS(8) * Number.EPSILON * max(1,|n|,|value|)`, test asserts
  a 3.5e12 market cap with diff=2 is still flagged ungrounded (would have passed silently under
  the old `1e-9 * |value|` ±3500 bound).
- `@internal` added to `DEEPSEEK_STALL_TIMEOUT_MS`, `DEEPSEEK_STALLED_CODE`,
  `DEEPSEEK_FALLBACK_MODEL`.

Consumer check (per [[feedback-cross-repo-resolution-claims-need-consumer-check]]): resolution
claimed `modelUsed` usage-row attribution to the *requested* model (not the model that actually
generated, post-fallback) is safe because it's request accounting only. Grepped
`siglens/src/entities/analysis/usageRepository.ts` — `getUsageToday` only counts by `actionType`
(analysis/chatbot/premium_model), never groups or filters by `modelUsed`. Claim holds for this
consumer.

New recommended finding (not a regression, pre-existing scope gap): `runMarketNewsDigest`
(`src/application/news/runMarketNewsDigest.ts`) also calls `callAnalysisAi` and defaults to
`DEEPSEEK_V4_1_FLASH_MODEL` when the caller passes an unknown/deprecated `modelId` — but
`SubmitMarketNewsDigestOptions` has no `providerFallback` field at all, so this DeepSeek call
site can never opt into the new fallback even from prewarm-like callers. Not wired in this PR,
not in `modified_files`. Worth asking whether market-news-digest prewarm should get the same
treatment as the other axes, or is intentionally out of scope (feed digest, not per-symbol
analysis, may have different risk tolerance).

R2 verdict: approved with 1 recommended finding.
