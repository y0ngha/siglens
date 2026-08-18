---
name: project-fix-tests2-mutation-audit
description: audit/fix-tests2 (worktree siglens-tests2) — 6 mutation-coverage fixes + 2 E2E test deletions, all independently re-verified by live mutation, approved round 1
metadata:
  type: project
---

Branch `audit/fix-tests2` (base `9861cb70` on `audit/kr-release`, worktree `/Users/y0ngha/Project/siglens-tests2`).
Fixes 7 of 13 tests a prior coverage audit proved tautological by mutation, plus 3 tautological E2E
assertions in `kr-equity-seo.spec.ts`. Round 1 = approved, no findings.

## What was independently re-verified (not just trusted from the report)

Re-ran 6 of the 7 named mutations live (author claimed 4 minimum) — all failed exactly as claimed:
1. `numberFormat.ts` KRW formatter `currency: 'KRW'`→`'USD'`: 1 test fails (`'US$333.6조'` vs pinned `'₩333.6조'`).
2. `overall/page.tsx` `hasOptions=true` hardcode AND `marketProfile="us-equity"` hardcode on
   `OverallFactualFallback`: each independently fails 1 of 16 tests in `page.body.test.tsx` (new
   `findElementByType`/`findSuspenseFallback` prop-pin test). `OverallContent.hasOptions` is now a
   required prop (no default) — confirmed its only production caller (`overall/page.tsx`) passes it
   explicitly; no second silent-default absorption point exists (contrast with the `audit/fix-seo`
   3-round history in [[project-overall-hasoptions-audit-fix-seo]] — this branch closes that lineage).
3. `isTabAllowedForSymbol` KR fast-path `return true`: 2 tests fail (options + congress).
4. `runPrewarmBatch.ts` starvation-watch mutations — **source file itself is unchanged in this
   branch** (not in the diff at all); only `runPrewarmBatch.test.ts` gained 2 new cases. Re-verified
   both: removing the `neverGenerated ||` clause fails the new partial-tab test; `STARVATION_AGE_THRESHOLD_MS × 100`
   fails the new SYM47H/50H/100H threshold+sort+units test.
5. `kindPanelRegistry.tsx` share panel: removing the `symbol !== ''` guard (leaving only
   `symbol !== undefined`) fails the new empty-string test — `profileIdForSymbol('')` falls back to
   us-equity → `hasOptions: true` wrongly. Verified via `isValidShareInput`
   (`entities/shared-analysis/server/assertValidInput.ts`) that `isNonEmptyString(o.symbol)` blocks
   `''` at snapshot-creation time — this guard is defensive/future-proofing, not a currently-reachable
   production bug.
6. `buildPopularEntries.ts` `classifyAsset(ticker)` (1-arg) → 3-arg with `CURATED_KOREAN_NAMES.get(ticker)`:
   new dedicated test file `buildPopularEntriesKrEtfGuard.test.ts` (mocks `POPULAR_TICKERS`/
   `CURATED_KOREAN_NAMES` with a synthetic `069500.KS` KODEX-200 fixture) fails when reverted.
   Traced `classifyAsset`'s 3 branches (`assetClassification.ts`): the `isKrEquitySymbol(symbol) &&
   isKrEtfName(name)` branch is the only one reading `name`, and it short-circuits on
   `isKrEquitySymbol(symbol)` first — so no US symbol's classification can change as a side effect,
   and the `fmpSymbol`(index) branch is unaffected since `fmpSymbol` stays `undefined` either way.
   Real-world caveat (not a finding): `POPULAR_TICKERS`' KR block is currently exactly the same 20
   named stocks as `CURATED_KOREAN_NAMES` (enforced by an existing code comment), and none are ETFs —
   so this fix is currently prophylactic (no live KR ETF ticker exists yet to visibly benefit), not
   fixing an active production defect.

## The two deletions — both judged sound after source-level verification

- `share.spec.ts:232` ("clicking ShareButton with no ready analysis shows dialog or unavailable
  notice") deleted. Verified both stated premises against source:
  - `useShareFlow.ts` `onClick`: `'pending'` → `setPreparingOpen(true)` (SharePreparingModal, role
    dialog, title "분석 준비 중" per `SharePreparingModal.tsx:41-53`) — genuinely a different element
    than either of the deleted test's two asserted targets (`ShareTriggerDialog` /
    `role="status"` unavailable notice).
  - `[symbol]/page.tsx:335` hardcodes `initialAnalysisFailed={true}` unconditionally (pre-existing,
    not touched by this branch) → `useAnalysis.ts`'s `isAnalyzing` derived var is `true`
    **synchronously on first render** whenever any hydration flag is still false, which it always is
    initially — so 'idle' is not a reliably observable status in the browser at click-time, not just
    theoretically unreachable.
  - The sibling deterministic test (forces `'error'` via cookie on `/AAPL/options`) reaches the exact
    same `ShareTriggerDialog` component, since `useShareFlow.ts` routes both `'idle'` and `'error'` to
    `setTriggerDialogOpen(true)`.
  - The `'pending'`→SharePreparingModal and `'unavailable'`→inline-notice branches this E2E test
    nominally covered are already deterministically covered at the unit/RTL level in
    `src/widgets/share/__tests__/ShareButton.test.tsx` (`describe('status === "pending"')`,
    `describe('status === "unavailable"')`, `describe('reg === null ...')`) — so the deletion doesn't
    leave those branches with zero coverage, only zero *E2E* coverage of an inherently racy scenario.
- `kr-equity-seo.spec.ts` 3 tautology fixes, all verified against source:
  - `≤120-char` check removed: `SEO_DESCRIPTION_MAX_LENGTH = 120` + `clampSeoDescription` (`shared/lib/seo.ts:120-134`)
    is applied to every `description:` field project-wide (KR and US alike) — the check could never fail structurally.
  - FAQ/HowTo language check re-scoped from serializing all JSON-LD blocks to just the `FAQPage`/`HowTo`
    blocks: confirmed `SITE_DESCRIPTION` (`shared/lib/seo.ts:473`) literally contains the literal string
    `한국` and is embedded in WebApplication/WebPage/Organization nodes on the same homepage response —
    a whole-blocks-array match would trivially pass regardless of FAQ/HowTo content.
  - 0.6× KR/US body-length ratio test deleted: E2E build has no FMP/LLM keys, both symbol paths share
    `FakeMarketProvider` and empty `seo_analysis_snapshots`, so the ratio is structurally ~1.0 in this
    environment — not a case a real KR-content regression could ever move below 0.6.

## Gates (all independently reproduced, not just trusted)

`yarn typecheck` / `yarn lint` (oxlint) / `yarn format --check` (oxfmt): all clean, zero output.
Scoped `vitest run` across all 8 non-E2E touched/new test files: 181 passed, 0 failed (author claimed
213 across 11 files including E2E specs, which can't run without a dev server in a review pass).

See [[project-kr-release-audit-round2]], [[project-overall-hasoptions-audit-fix-seo]],
[[feedback-audit-enumerate-slice-not-difflist]], [[project-coverage-pr-patterns]].
