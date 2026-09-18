---
name: project-deepseek-stall-gemini-fallback-r1
description: siglens-core feat/deepseek-stall-gemini-fallback R1 — usage-attribution gap and roundsTo epsilon scaling issue found
metadata:
  type: project
---

R1 (2026-09-15) of siglens-core-wt-fallback branch `feat/deepseek-stall-gemini-fallback`
(stall watchdog + DeepSeek→Gemini fallback + groundedNumbers half-step fix).

Two non-obvious required findings, both needed tracing beyond the diffed files:

1. **Usage/telemetry silently misattributed.** `callAnalysisAi`'s DeepSeek→Gemini fallback
   is fully internal to a private `generate()` closure — it returns only a `string`, so none
   of the 7 call sites (`runAnalysis`, `runOptionsAnalysis`, `runFinancialsAnalysis`,
   `runFundamentalAnalysis`, `runNewsAnalysis`, `runOverallAnalysis`, `runCongressTrend`) can
   ever learn a fallback happened. Each still calls `recordAnalysisUsageSafely(usage,
   effectiveModelId/modelId, ...)` with the originally-requested DeepSeek model id, so
   `modelUsed` is persisted as DeepSeek even when Gemini actually generated (and was billed).
   Found by grepping `recordAnalysisUsageSafely` call sites across `src/application/*`, not
   visible from the 3 diffed files alone.

2. **`roundsTo` epsilon scales with raw magnitude, not with the half-step.**
   `HALF_STEP_EPSILON * Math.max(1, Math.abs(parsed.value))` was meant to absorb binary-float
   noise near an exact half (the fix's actual motivating case), but for `decimals: 0` financial
   magnitudes (market cap ~$3.5T) it widens grounding tolerance to roughly ±3500 — verified live
   with a one-off node script — defeating the whole point of the anti-hallucination grounding
   check for large numbers. No test covers this magnitude regime (all new tests are small
   index-price/volume values).

Also recurring-mistake catch: 3 new exported constants (`DEEPSEEK_STALL_TIMEOUT_MS`,
`DEEPSEEK_STALLED_CODE`, `DEEPSEEK_FALLBACK_MODEL`) are not re-exported from `src/index.ts`
and lack `/** @internal */` tags — MISTAKES.md #9.5, already flagged as recurring 3+ times.

Verified sound: withRetry's `AI_SERVER_UNSTABLE_CODE` sentinel error has no `.status` field so
`isFallbackEligible` correctly treats it as fallback-eligible; abort-vs-stall distinction is
mutually exclusive and test-covered; fake-timer tests use `advanceTimersByTimeAsync` correctly.
