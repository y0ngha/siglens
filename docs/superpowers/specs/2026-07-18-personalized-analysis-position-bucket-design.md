# Personalized Analysis by Position Bucket (Subsystem C) — Design

- **Date**: 2026-07-18
- **Status**: Design (pending approval — this is a CROSS-REPO change touching `@y0ngha/siglens-core` + a release)
- **Depends on**: A (holdings, PR #691) + B (position math, PR #692). C reuses A's server-side `findByUserAndSymbol` and the "position vs range" concept from B.
- **Position**: Subsystem **C** of `A → B → C → D` (reordered: C before D so D can honestly advertise a shipped feature).

## 1. Goal

When a logged-in **member** has a holding for the symbol, personalize the AI analysis to their situation — "you're deep in profit / near breakeven / at a loss" — WITHOUT shattering the shared analysis cache. The member's average price is NEVER put raw into the cache key or prompt; instead it is quantized server-side into a coarse **position bucket** (~5 levels) that drives a qualitative prompt hint and a cache-key suffix.

## 2. Cross-repo scope (⛔ this is why C is different from A/B)

C touches the analysis DOMAIN, which lives in `@y0ngha/siglens-core`. Per the SCOPE guard, the prompt + cache-key changes MUST be made in the core repo, not siglens. Split:

| Piece | Repo |
|---|---|
| `PositionBucket` type + **pure `bucketizePosition(avg, currentPrice)`** (no I/O) | **siglens-core** (domain/analysis) |
| `buildAnalysisCacheKey` `:pos=<bucket>` suffix (optional param) | **siglens-core** (infrastructure/cache/config) |
| Prompt hint injection (`dynamic` section) | **siglens-core** (domain/analysis/prompt.ts) |
| ~~`PROMPT_TEMPLATE_VERSION` bump~~ **NO bump** (§4) — document "deliberately not bumped" | **siglens-core** |
| `submitAnalysis`/`peekAnalysisCache` accept a **finished `positionBucket?` enum**, thread to key + prompt | **siglens-core** |
| **Compute the bucket** (server-read avg + cached current price → `bucketizePosition`) | **siglens** action (§6 — NOT core, see feasibility) |
| Core release (0.36.0 → **0.37.0**) | **siglens-core** — user approves the PR, then release (`yarn release:minor` → tag → CI publish) |
| `resolvePositionBucket` server gate (tier≠free, server-read holding) | **siglens** (shared/lib or entities/analysis) |
| `submitAnalysisAction` server-reads avg, passes `avgPrice` to core | **siglens** |
| `useAnalysis` re-run on holding change (hydration-gated) | **siglens** |
| `SymbolModelContext` sources avg from `useSymbolHolding` | **siglens** |
| `peekAnalysisStaticCache` pins no-bucket | **siglens** |
| dep bump to 0.37.0 + `yarn install` | **siglens** (after core publish) |

## 3. Position bucket (the cache-safety mechanism)

`PositionBucket = 'deep-profit' | 'profit' | 'near-breakeven' | 'loss' | 'deep-loss'` (new core domain type).

**Bucketizer (pure, core):** `bucketizePosition(avgPrice: number, currentPrice: number): PositionBucket | null`. Based on the member's unrealized return `r = (current - avg) / avg`:
- `r >= +0.20` → `deep-profit`
- `+0.05 <= r < +0.20` → `profit`
- `-0.05 < r < +0.05` → `near-breakeven`
- `-0.20 < r <= -0.05` → `loss`
- `r <= -0.20` → `deep-loss`
- returns `null` when `avg <= 0` / `current <= 0` / non-finite (→ no bucket → legacy no-bucket key + prompt).

Boundaries are illustrative; finalize during core impl. Keeping it return-based (not range-position) makes it independent of the 252-bar range and robust; it's a coarse **profit/loss band**, which is what a member cares about for "should I hold." (B's range-position is a separate, complementary lens; C keys on P&L band.)

**Cardinality:** analysis cache key = existing key × (≤5 buckets + no-bucket). No explosion. Members in the same P&L band share a cache entry.

## 4. Cache key (mirror the `reasoning` precedent)

In core `infrastructure/cache/config.ts`, add a sibling to `reasoningKeySuffix`:
```ts
function positionKeySuffix(bucket?: PositionBucket): string {
    return bucket ? `:pos=${bucket}` : '';   // no-bucket → '' → byte-identical legacy key
}
```
`buildAnalysisCacheKey(...reasoning?, positionBucket?)` composes: `${...}${reasoningKeySuffix(reasoning)}${positionKeySuffix(positionBucket)}` (stable order). `undefined`/no-bucket produces the EXACT legacy key (backward compatible — warm entries + SSR peek keep hitting the same key). Mirror in the sibling builders IF C extends to fundamental/overall (v1: technical/chart analysis only — keep scope tight).

## 5. Prompt (the one divergence from `reasoning`)

`reasoning` never touches prompt bytes; the bucket DOES. In core `domain/analysis/prompt.ts` `buildAnalysisPrompt`, add `positionBucket?` and push a `formatPositionHintSection(bucket)` line into the **`dynamic`** sections array (NOT `stable` — a per-member value must not pollute the byte-cached stable system-prompt prefix). The hint is **qualitative and NEUTRAL** (no raw avg/quantity; state the band, don't instruct action-tailoring — leave recommendations to existing guardrails to avoid drifting into per-user financial advice): e.g. `"참고: 이 사용자는 현재 이 종목에서 '{깊은 수익/수익/본전 부근/손실/깊은 손실}' 구간에 있습니다."` (finalize copy in impl).

**⛔ DO NOT bump `PROMPT_TEMPLATE_VERSION` (critical-review correction).** The bucketed path lands on a brand-new key namespace (`:pos=<bucket>`) that was never written before, so NO previously-cached entry becomes stale, and the no-bucket path is byte-identical. `PROMPT_TEMPLATE_VERSION` is SHARED by the technical AND fundamental cache keys AND the SSR peek — bumping it would needlessly cold-start the entire warm cache (technical + fundamental, every symbol/timeframe/model) + all anonymous SSR shells, for zero correctness gain. Instead, add a `@remarks`-style comment on `PROMPT_TEMPLATE_VERSION` documenting "position hint deliberately NOT bumped — new-key isolation" (mirror the existing "Deliberately NOT bumped" precedents for `ECONOMIC_EVENT_...`/`INDICATOR_TRANSLATION_...` in the same file).

**Sampling seed:** the bucket does NOT join the skill-sampling seed (`reasoningSeedPart`) — it must not change WHICH skills are sampled, only the hint + key.

## 6. Server-read avg (NEVER client-trusted)

The avg price feeds the shared cache key, so a client-passed avg would be **spoofable + cache-poisoning**. The avg is read SERVER-SIDE, and **the bucket is computed in the siglens ACTION, NOT in core (critical-review feasibility fix):**

> ⚠️ **Why not core:** `submitAnalysis` freezes the cache key (submitAnalysis.ts:343) BEFORE it fetches bars (:385), and on a cache HIT it fetches no bars at all. So core does NOT have the current price when the key is built — it cannot compute a price-dependent bucket pre-key. The bucket must be a FINISHED value passed in.

- In `submitAnalysisAction` (siglens): after resolving `userId` + tier, `getCurrentUser()` → `DrizzlePortfolioRepository(db).findByUserAndSymbol(userId, symbol)` → `averagePrice` (server-read). Obtain the current price from the action's `CachedMarketDataProvider` (the SAME cached last-close the analysis snapshot uses — so the "you're in profit" band stays consistent with the analysis, not a divergent live quote). Compute `bucket = resolvePositionBucket(tier, holding, currentPrice)` which calls core's pure `bucketizePosition(avg, currentPrice)` and gates to `tier !== 'free'` && holding-exists (free → `undefined`, mirrors `resolveReasoning`).
- Pass the **finished `positionBucket?: PositionBucket` enum** (never the raw avg) into core's `submitAnalysis` options. Core only appends `:pos=<bucket>` to the key + injects the hint — no price math, no key derivation from avg.
- The CLIENT never sends the avg for correctness. It only TRIGGERS a re-run when the member's holding changes (below).
- **Cost note:** the action pays a (usually cached) current-price read on every member-with-holding submit, even when the analysis itself would be a cache hit. Acceptable, but a real added dependency.

## 7. Client threading (re-run on holding change, hydration-gated)

Mirror the `reasoning`-change machinery in `useAnalysis`:
- Source the member's avg for the current symbol from `useSymbolHolding(symbol)` — which lives in **`features/portfolio-holding`** (a FEATURE, not entities — critical-review layer correction). `useAnalysis` (view layer) may import it directly; if `SymbolModelContext` (`features/symbol-model`) also sources it, that's a **cross-feature import needing a new ESLint `boundaries` exception** entry in `src/features/CLAUDE.md` (like the existing `symbol-model → analysis-nudge` exception) — budget it.
- Add a holding-change effect cloned from the reasoning-change effect: when the member's avg (or its presence) changes post-hydration, call `restartAnalysis()` so a fresh `submitAnalysisAction` runs (server re-reads authoritative avg → new bucket → new key → cache hit/miss). Do NOT `force` (we want same-bucket cache hits).
- **Race hardening (critical-review):** suppress the first submit until the per-symbol holding query is RESOLVED — gate on `isLoading === false` (not just `isHydrated`), because on a client-side nav to a new symbol the holdings query refetches (hydrated but loading) and could fire a premature no-bucket submit (a wasted shared-cache write) then a bucketed re-run. `useSymbolHolding` selects per-symbol, so key the effect on the resolved holding for the CURRENT symbol.
- The client MAY pass the avg as a trailing trigger arg to `submitAnalysisAction` purely to change the mutation inputs (drive the re-run); the action IGNORES it for correctness and re-reads server-side. (Simplest: trigger via the effect, no new arg trusted.)
- `SymbolModelContext`: optionally expose `avgPrice`/`isHoldingHydrated` sourced from `useSymbolHolding` for parity with `canUseReasoning`/`isReasoningHydrated`.

## 8. SSR peek — pin no-bucket (same mechanism as reasoning=false)

`peekAnalysisStaticCache.peekAnalysisStatic` currently pins `reasoning=false` + `tier='free'` as literals into core `peekAnalysisCache` and EXCLUDES them from the `unstable_cache` key array (they never vary). C adds `positionBucket=undefined` (no-bucket) as a pinned literal + does NOT add it to the key array. This keeps the anonymous SSR shell aligned with the anonymous **no-bucket** writer key (an anon/free visitor's `submitAnalysisAction` writes no-bucket since free never gets a bucket). Core `peekAnalysisCache` gains the same trailing `positionBucket?` param defaulting to no-bucket, mirroring how it defaults `reasoning` off + `tier` to `DEFAULT_TIER`.

## 9. UX

- **Automatic** for members with a holding (no toggle) — the user's stated intent ("로그인+평단 설정되어 있으면 분석에 활용"). When a holding exists and tier≠free, analysis is personalized; otherwise it's the shared/base analysis.
- The personalized analysis is a **cache variant** (base for guests/free/no-holding; bucketed for members-with-holding), so guests/SSR are unaffected (they read the no-bucket key).
- Consider a subtle "내 평단 기준으로 분석했어요" affordance in the analysis panel so the member knows it's personalized (small; finalize in impl). This also sets up D's nudge copy.

## 10. Testing

- **core**: `bucketizePosition` pure (all bands + boundaries + null guards); `positionKeySuffix` + `buildAnalysisCacheKey` (no-bucket = legacy key byte-identical; each bucket = distinct key); `submitAnalysis`/`peekAnalysisCache` thread the bucket to key + prompt; prompt hint present in `dynamic` only when bucketed; PROMPT_TEMPLATE_VERSION = p7.
- **siglens**: `resolvePositionBucket` gate (free → no bucket; member+holding → avg; no holding → none); `submitAnalysisAction` server-reads avg + passes it (never trusts client); `useAnalysis` re-runs on holding change, hydration-gated, no premature no-bucket submit; `peekAnalysisStaticCache` pins no-bucket; queryKey unchanged for base.
- **e2e** (authed): a member with a profitable AAPL holding gets a personalized analysis (assert the affordance / a bucketed marker); a guest gets the base analysis; changing the holding re-runs analysis.
- **overlay local verification** (per repo convention): build core locally, overlay into siglens, verify end-to-end before the core release.

## 11. Rollout (⚠️ cross-repo, user-gated release)

1. Core branch: implement + test → **core PR** → USER approves.
2. After approval: `yarn release:minor` (0.37.0) → tag `v0.37.0` → CI publishes to GitHub Packages.
3. Siglens branch (stacked on B or off master-after-B): bump dep to 0.37.0 + `yarn install`, implement the threading + tests → **siglens PR**.
4. Local verification uses an **overlay** (built core → siglens/node_modules) so nothing is blocked on the publish for testing.
- **Backward compat**: no-bucket path is byte-identical + same key; the `p7` bump cold-starts the technical prompt cache once (acceptable; self-healing). New core param is optional → old siglens keeps working against 0.37.0.

## 12. Risks & open items

- **PROMPT_TEMPLATE_VERSION bump invalidates warm technical analysis once** — a one-time cold-start cost across all symbols (like prior p-bumps). Acceptable; note it.
- **Bucket boundary choice** (±5%/±20%) is a product feel decision — finalize in impl; easy to tune (it's just the bucketizer).
- **Cost**: cardinality ×(≤6) is bounded, but personalized entries are net-new cache writes for members. Monitor. (This is exactly why we bucketed instead of raw-avg.)
- **The `p7` bump + cache-key change are the highest-risk edits in the whole A–D feature** — they affect the entire analysis pipeline. This is why C gets a core PR + critical review + overlay verification before release.
- **avg staleness**: the server reads the avg at submit time; if the member edits their holding, the client re-run picks up the new bucket. Fine.
