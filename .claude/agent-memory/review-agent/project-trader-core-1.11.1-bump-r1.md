---
name: trader-core-1.11.1-bump-r1
description: siglens-trader chore/core-1.11.1 R1 — pure dependency bump (package.json + yarn.lock only); core's riskReward-text prepend-condition change confirmed not consumed by trader
metadata:
  type: project
---

siglens-trader worktree `/Users/y0ngha/Project/siglens-trader-wt-rr`, branch chore/core-1.11.1 (2026-09-19). Approved, round 1. Diff is only `@y0ngha/siglens-core` 1.11.0→1.11.1 in package.json + the matching yarn.lock entry (checksum/resolution) — no other hunks.

Core 1.11.1 (siglens-core PR #215) changes when the deterministic risk:reward line gets prepended into `recommendation.riskReward` (free-text prose field): now gated on `wasReconciled` (core actually corrected a level) instead of `reconciledLevels` presence (which the model can fill on a healthy response too). Also unifies `nearestTargetAbove` between that text builder and `planCheck.riskRewardAtEntry`.

- Grepped trader for `riskReward`/`reconciledLevels`/`planCheck`/`buildBullishRiskRewardText`: trader's `riskReward` hits are its own local domain fns (`lib/strategy/entry-zone.ts` `riskRewardRatio`/`formatRiskReward`, `lib/analysis/trade-gate.ts`), unrelated to core's field. Trader's local `ActionRecommendation` interface (`lib/strategy/signal-scorer.ts`) only has `entryRecommendation` — no `riskReward`. `planCheck` has zero hits anywhere in trader. `reconciledLevels` is read in `lib/strategy/safe-extract.ts`/`trade-gate.ts` but only its structured `stopLoss`/`takeProfitPrices`/`reason` fields (for sizing/prompt rendering), never the `riskReward` prose sub-field or the top-level `recommendation.riskReward` string — so the prepend-condition change is inert for trader.
- No prompt/cache version constant to bump: `AGENT_PROMPT_VERSION` bump in 1.11.1 is agent-chat-only, and trader has zero hits for `PROMPT_TEMPLATE_VERSION`/`AGENT_PROMPT_VERSION`/`CACHE_VERSION`.
- yarn.lock diff is exactly 2 hunks (dependency entry + trader's own devDependency version string) — nothing unexpected pulled in.

**Why:** confirms the pattern from [[trader-precomputed-core-1.11-r1]]/[[trader-precomputed-core-1.11-r2]] — trader computes its own risk:reward locally and never parses core's prose `riskReward` field, so behavior changes to that text are safe to no-op on this side.

**How to apply:** for a core patch bump with a described behavior change, grep the consumer for every symbol named in the changelog (including nested fields like `.riskReward`, `.reconciledLevels.riskReward`) before approving — a hit on a similarly-named *local* symbol (trader's own `riskRewardRatio`) is not the same thing and must be traced back to its actual definition.
