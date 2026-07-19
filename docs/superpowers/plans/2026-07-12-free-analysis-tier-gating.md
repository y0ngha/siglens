# Free Analysis Tier Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict `free` technical analysis to daily candles, cap its prompt skills per type, and provide only a safe preview while `member` and `pro` receive the full report.

**Architecture:** `siglens-core` owns access policy, effective prompt skill fingerprints, cache keys, and response redaction. `siglens` keeps the symbol route ISR-safe by serializing only the free projection, then obtains the requester-tier projection through a server action after hydration. Free shares serialize the same safe data they received and never show a blur overlay.

**Tech Stack:** TypeScript, Vitest, Next.js 16, React Query, Tailwind, `@y0ngha/siglens-core`.

---

## File Structure

- Core policy/types: `siglens-core/src/domain/tier.ts`, `src/domain/types.ts`, `src/application/market/types.ts`.
- Core prompt/cache: `siglens-core/src/domain/analysis/selectSkills.ts`, `src/domain/analysis/prompt.ts`, `src/domain/analysis/fundamentalPrompt.ts`, `src/domain/analysis/financialsPrompt.ts`, `src/domain/analysis/newsPrompt.ts`, `src/domain/analysis/marketNewsDigestPrompt.ts`, their submit paths, `src/application/market/submitAnalysis.ts`, `src/application/market/pollAnalysis.ts`, `src/application/market/peekAnalysisCache.ts`, `src/infrastructure/cache/config.ts`, `src/infrastructure/hash/analysisInput.ts`, `src/infrastructure/jobs/types.ts`.
- App analysis bridge: `siglens/src/entities/analysis/actions/submitAnalysisAction.ts`, `src/entities/analysis/lib/peekAnalysisStaticCache.ts`, `src/app/[symbol]/page.tsx`, `src/views/symbol/hooks/useAnalysis.ts`.
- App presentation: `src/views/symbol/hooks/useTimeframeChange.ts`, `src/widgets/chart/TimeframeSelector.tsx`, `src/views/symbol/SymbolPageClient.tsx`, `src/widgets/analysis/AnalysisPanel.tsx`, new `src/widgets/analysis/LockedAnalysisSection.tsx`.
- Sharing: `src/entities/shared-analysis/types.ts`, `src/entities/shared-analysis/server/assertValidInput.ts`, `src/views/share/kindPanelRegistry.tsx`.

## Task 1: Enable Only the Requested Tier Policies in Core

**Files:**
- Modify: `siglens-core/src/domain/types.ts`
- Modify: `siglens-core/src/domain/tier.ts`
- Test: `siglens-core/src/__tests__/domain/tier.test.ts`
- Test: `siglens-core/src/__tests__/index.test.ts`

- [ ] **Step 1: Write failing policy assertions**

Add assertions that `free` allows only `['1Day']`, both `member` and `pro` allow `TIMEFRAMES`, free cannot access `full_detail`, member can access every information depth, and the free model/usage policies remain unrestricted.

- [ ] **Step 2: Run the focused test**

Run: `yarn vitest run src/__tests__/domain/tier.test.ts src/__tests__/index.test.ts`

Expected: FAIL because `enableTierRestrictions: false` currently bypasses all policies.

- [ ] **Step 3: Implement granular flags**

Add `enableTimeframeRestrictions` and `enableInfoDepthRestrictions` to the tier feature flags. Make timeframe and information-depth resolvers use only their respective flag. Configure:

```ts
timeframes: { free: ['1Day'], member: [...TIMEFRAMES], pro: [...TIMEFRAMES] }
infoDepth: { free: ['direction', 'summary'], member: PRO_INFO_DEPTH, pro: PRO_INFO_DEPTH }
featureFlags: { enableTierRestrictions: false, enableTimeframeRestrictions: true, enableInfoDepthRestrictions: true }
```

- [ ] **Step 4: Re-run the focused test**

Run: `yarn vitest run src/__tests__/domain/tier.test.ts src/__tests__/index.test.ts`

Expected: PASS.

## Task 2: Select at Most Three Free Skills Per Skill Type

**Files:**
- Modify: `siglens-core/src/domain/analysis/selectSkills.ts`
- Modify: `siglens-core/src/domain/types.ts`
- Modify: `siglens-core/src/infrastructure/hash/analysisInput.ts`
- Modify: `siglens-core/src/infrastructure/cache/config.ts`
- Test: `siglens-core/src/__tests__/domain/analysis/selectSkills.test.ts`
- Test: `siglens-core/src/__tests__/infrastructure/cache/skillFingerprint.test.ts`

- [ ] **Step 1: Add failing selection tests for every prompt family**

Call `selectSkills` with `{ tier: 'free', seed: 'technical:AAPL:1Day:model:catalog-fingerprint' }`. Assert every `SkillType` bucket contains at most three skills, the same seed produces the same selection, a different cache-key seed can change the selection, and member/pro are uncapped. Add builder tests for technical, fundamental, financials, symbol news, and market-news digest paths.

- [ ] **Step 2: Run the selection tests**

Run: `yarn vitest run src/__tests__/domain/analysis/selectSkills.test.ts src/__tests__/infrastructure/cache/skillFingerprint.test.ts`

Expected: FAIL because selection has no tier-aware cap or effective-selection fingerprint.

- [ ] **Step 3: Implement deterministic catalog sampling before relevance selection**

Before prompt-context and relevance selection, sort each `skill.type ?? 'regular'` catalog group, use a deterministic cache-key seed shuffle, and retain no more than three entries in each group only for `free`. Do not mutate the catalog or call `Math.random`. Pass the policy through every prompt builder that calls `selectSkills`.

- [ ] **Step 4: Isolate cache entries by effective skills**

Hash the deterministic free subset, not just the full catalog. Pass its fingerprint through every affected submit path, cache-key builder, job metadata, poll cache write, and cache peek. Bump each affected prompt-template version so prior prompts cannot be reused.

- [ ] **Step 5: Verify prompt and cache behavior**

Run: `yarn vitest run src/__tests__/domain/analysis/selectSkills.test.ts src/__tests__/infrastructure/cache/skillFingerprint.test.ts src/__tests__/infrastructure/cache/config.test.ts`

Expected: PASS.

## Task 3: Return Tier-Filtered Technical Results Without Storing Filtered Cache Values

**Files:**
- Modify: `siglens-core/src/application/market/types.ts`
- Modify: `siglens-core/src/domain/types.ts`
- Modify: `siglens-core/src/application/market/submitAnalysis.ts`
- Modify: `siglens-core/src/application/market/pollAnalysis.ts`
- Modify: `siglens-core/src/application/market/peekAnalysisCache.ts`
- Modify: `siglens-core/src/infrastructure/jobs/types.ts`
- Test: `siglens-core/src/__tests__/application/market/submitAnalysis.test.ts`
- Test: `siglens-core/src/__tests__/application/market/pollAnalysis.test.ts`
- Test: `siglens-core/src/__tests__/application/market/peekAnalysisCache.test.ts`
- Test: `siglens-core/src/__tests__/domain/analysis/filterAnalysisResult.test.ts`

- [ ] **Step 1: Write failing boundary tests**

Assert a free cached result has `indicatorResults: null` and a nonempty `lockedInfoDepth`; assert member returns the original `AnalysisResponse` and `lockedInfoDepth: []`; assert free intraday is rejected before worker dispatch.

- [ ] **Step 2: Run the market tests**

Run: `yarn vitest run src/__tests__/application/market/submitAnalysis.test.ts src/__tests__/application/market/pollAnalysis.test.ts src/__tests__/application/market/peekAnalysisCache.test.ts src/__tests__/domain/analysis/filterAnalysisResult.test.ts`

Expected: FAIL because cached and poll results are currently always full `AnalysisResponse` values.

- [ ] **Step 3: Introduce the filtered technical result contract**

Use `{ result: AnalysisResponse | FilteredAnalysisResponse; lockedInfoDepth: readonly TierInfoDepth[] }` for cached and done technical results. Keep Redis values as raw normalized `AnalysisResponse`, then call `filterAnalysisResult` only when returning to a requester.

- [ ] **Step 4: Persist reproducibility metadata**

Store the originating `tier` and effective `skillFingerprint` in `JobMeta`. Poll must use them for the exact cache key and return projection, never reselect skills randomly.

- [ ] **Step 5: Extend cache peek with a tier-aware options object**

Add a typed options argument containing `tier`, model identity, reasoning, and effective skill fingerprint. The static app caller uses `tier: 'free'`; the dynamic action uses the resolved account tier.

- [ ] **Step 6: Verify core behavior**

Run: `yarn vitest run src/__tests__/application/market src/__tests__/domain/analysis/filterAnalysisResult.test.ts src/__tests__/infrastructure/cache`

Run: `yarn typecheck`

Expected: PASS.

## Task 4: Release Core Before Changing Siglens

**Files:**
- Modify: `siglens-core/package.json` and generated release metadata
- Modify: `siglens/package.json`
- Modify: `siglens/yarn.lock`

- [ ] **Step 1: Validate core**

Run: `yarn lint && yarn typecheck && yarn test`

Expected: PASS.

- [ ] **Step 2: Use the required review and release workflow**

Create the core PR through the repository workflow, obtain approval, merge, run `yarn release`, and verify the published package version. Do not merge or release before approval.

- [ ] **Step 3: Update siglens**

Set the core dependency to the released version and run `yarn install`. Verify the lockfile resolves that exact release.

## Task 5: Keep the Symbol Route ISR-Safe and Hydrate the Correct Tier Result

**Files:**
- Modify: `siglens/src/entities/analysis/lib/peekAnalysisStaticCache.ts`
- Modify: `siglens/src/entities/analysis/index.ts`
- Modify: `siglens/src/app/[symbol]/page.tsx`
- Modify: `siglens/src/views/symbol/SymbolPageClient.tsx`
- Modify: `siglens/src/views/symbol/hooks/useAnalysis.ts`
- Test: `siglens/src/entities/analysis/__tests__/lib/peekAnalysisStaticCache.test.ts`
- Test: `siglens/src/app/[symbol]/__tests__/page.test.ts`
- Test: `siglens/src/views/symbol/__tests__/hooks/useAnalysis.test.tsx`

- [ ] **Step 1: Add SSR leak and hydration replacement tests**

Assert the static peek returns only a free-filtered value. Mock a member session and assert the first non-forced submit returns the complete cached report without invoking worker dispatch.

- [ ] **Step 2: Implement safe static and dynamic reads**

Keep `unstable_cache` in `peekAnalysisStatic`, but call core with the free tier. Make `submitAnalysisAction` resolve and forward the tier on every request, including no-model requests, so an ordinary non-forced call returns the matching tier-projected cache entry or performs the existing miss flow.

- [ ] **Step 3: Preserve locked metadata in the hook**

Change `SymbolPageClient` and `useAnalysis` from an `AnalysisResponse`-only initial prop to the filtered-result contract. Keep the normalized UI value separate from `lockedInfoDepth` so `null` means locked, not merely empty.

- [ ] **Step 4: Replace the preview after user resolution**

After model, reasoning, and tier hydration settle, invoke the existing non-forced submit once. Replace the initial free preview on a hit. On a miss, use its existing submit/poll path exactly once.

- [ ] **Step 5: Run focused tests**

Run: `yarn vitest run src/entities/analysis/__tests__/submitAnalysisAction.test.ts src/entities/analysis/__tests__/lib/peekAnalysisStaticCache.test.ts src/app/[symbol]/__tests__/page.test.ts src/views/symbol/__tests__/hooks/useAnalysis.test.tsx`

Expected: PASS.

## Task 6: Gate the Selector, Query Parameter, and Server Action

**Files:**
- Modify: `siglens/src/entities/analysis/actions/submitAnalysisAction.ts`
- Modify: `siglens/src/views/symbol/hooks/useTimeframeChange.ts`
- Modify: `siglens/src/views/symbol/SymbolPageClient.tsx`
- Modify: `siglens/src/widgets/chart/TimeframeSelector.tsx`
- Test: `siglens/src/entities/analysis/__tests__/submitAnalysisAction.test.ts`
- Test: `siglens/src/views/symbol/hooks/__tests__/useTimeframeChange.test.tsx`
- Test: `siglens/src/widgets/chart/__tests__/TimeframeSelector.test.tsx`

- [ ] **Step 1: Add guest/member action tests**

Assert every technical submit resolves the user tier even without `modelId`, passes free for guests and member for accounts, and rejects a free `5Min` request before worker work starts.

- [ ] **Step 2: Implement unconditional tier context**

Resolve the user before the model/BYOK branch, pass `tierContext` to every core submit, and preserve the existing E2E fixture short-circuit.

- [ ] **Step 3: Add selector and URL tests**

Assert the free 5-minute button is disabled with an accessible locked label, member controls are enabled, and a settled free `?tf=5Min` route is replaced with `?tf=1Day` without prefetching intraday bars.

- [ ] **Step 4: Implement the client boundary**

Give `TimeframeSelector` an `allowedTimeframes` prop. Render unavailable values as disabled lock buttons. In `useTimeframeChange`, wait for auth resolution before normalizing and guard unavailable choices before cancellation or prefetch.

- [ ] **Step 5: Run focused tests**

Run: `yarn vitest run src/entities/analysis/__tests__/submitAnalysisAction.test.ts src/views/symbol/hooks/__tests__/useTimeframeChange.test.tsx src/widgets/chart/__tests__/TimeframeSelector.test.tsx`

Expected: PASS.

## Task 7: Render Free Locks and Safe Shared Reports

**Files:**
- Create: `siglens/src/widgets/analysis/LockedAnalysisSection.tsx`
- Modify: `siglens/src/widgets/analysis/AnalysisPanel.tsx`
- Modify: `siglens/src/entities/shared-analysis/types.ts`
- Modify: `siglens/src/entities/shared-analysis/server/assertValidInput.ts`
- Modify: `siglens/src/views/share/kindPanelRegistry.tsx`
- Test: `siglens/src/widgets/analysis/__tests__/AnalysisPanel.test.tsx`
- Test: `siglens/src/entities/shared-analysis/__tests__/assertValidInput.test.ts`
- Test: `siglens/src/views/share/__tests__/ShareKindPanel.test.tsx`

- [ ] **Step 1: Add locked-section tests**

Assert a locked free section displays a signup link and does not render hidden indicator/pattern/strategy text. Assert the identical filtered result in a share displays its available fields with no blur, lock, or signup CTA.

- [ ] **Step 2: Implement a fixed-size locked section**

Build a reusable blurred inert placeholder with accessible explanatory text and a `/signup` link. It must not receive hidden content and must keep a stable layout height.

- [ ] **Step 3: Map `lockedInfoDepth` in `AnalysisPanel`**

Render summary and direction normally. Replace each missing detail group with one locked section per depth. Disable copy-report when any locked depth exists so hidden placeholders cannot be represented as real advice.

- [ ] **Step 4: Support filtered chart snapshots**

Allow the chart share schema to contain the core filtered technical result. The share panel normalizes null detail fields to omitted sections and always passes an empty locked-depth list, preserving the no-blur rule.

- [ ] **Step 5: Run focused tests**

Run: `yarn vitest run src/widgets/analysis/__tests__/AnalysisPanel.test.tsx src/entities/shared-analysis/__tests__/assertValidInput.test.ts src/views/share/__tests__/ShareKindPanel.test.tsx`

Expected: PASS.

## Task 8: Cross-Repository Verification

**Files:**
- Modify if needed: `siglens/e2e/specs/symbol-analysis.spec.ts`
- Modify if needed: `siglens/e2e/specs/share.spec.ts`

- [ ] **Step 1: Run core gates**

Run in `siglens-core`: `yarn lint`, `yarn typecheck`, and `yarn test`.

- [ ] **Step 2: Run app gates**

Run in `siglens`: `yarn lint`, `yarn tsc --noEmit`, and the scoped Vitest suites for analysis, symbol, chart, analysis panel, shared analysis, and share views.

- [ ] **Step 3: Verify browser scenarios**

1. Guest `?tf=5Min` converges to daily and intraday controls are disabled.
2. Member retains intraday selection and receives the complete report.
3. Guest network payload contains no locked values, displays signup locks, and shares the safe result without a blur.
4. Member/pro shares display complete results without a blur.

- [ ] **Step 4: Complete review handoff**

Run the mandated review workflow for each repository, retain only scoped changes, and report validation results.
