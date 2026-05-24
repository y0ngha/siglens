# Overall Analysis — Options Axis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote options analysis to a 4th dependency axis of `/[symbol]/overall`, matching the existing technical/fundamental/news pattern. Adds graceful NoChains handling, OI staleness signal, and an always-visible re-analyze button.

**Architecture:** Both `@y0ngha/siglens-core` and `siglens` change. Core extends `OverallAxis` union, dependency resolver, prompt, normalizer, and cache key. App extends the polling hook, server action, and UI to render the 4th section + re-analyze button. Core build output is rsync'd into the app's `node_modules/@y0ngha/siglens-core/dist` between phases for hot integration during development.

**Tech Stack:** TypeScript, Next.js 16 App Router, React Query, lightweight-charts (unrelated to this work but project-wide), Jest, FMP/Yahoo data providers, Vercel `waitUntil` for background jobs.

---

## Pre-flight Decisions (resolved during planning)

- **Re-analyze force semantics:** Add `OverallDependencyInputs.force?: boolean` top-level field. Resolver computes per-axis effective force as `topLevel.force ?? axis.force ?? false` (OR-style precedence). Keeps existing `technical.force` for backward compat. Reason: spec mandates "4-axis full force" for re-analyze; a single top-level flag is the smallest change that meets the spec.
- **Cache invalidation strategy:** Natural invalidation via `inputHash` including options input. No `CACHE_KEY_SCHEMA_VERSION` bump.
- **Worktree paths:**
  - Core: `/Users/y0ngha/Project/siglens-core-overall-options` (branch `feat/overall-options-axis` from `main`)
  - App: `/Users/y0ngha/Project/siglens-overall-options` (branch `feat/overall-options-axis` from `master`)

## File Structure

### siglens-core changes

| File | Action | Responsibility |
|---|---|---|
| `src/application/overall/types.ts` | Modify | Extend `OverallAxis` union; add `OverallDependencyInputs` fields for options + top-level `force`; add `DependencyState` variant for options skipped |
| `src/domain/types.ts` | Modify | Add `optionsBulletsKo`, `optionsOiStale` to `OverallAnalysisResponse` + `RawOverallAnalysisResponse`; rename `threeAxisConclusionKo` → `integratedConclusionKo` |
| `src/application/overall/pickNearestExpiration.ts` | Create | Pure helper: select nearest valid expiration from snapshot.chains |
| `src/application/overall/dependencyResolver.ts` | Modify | Add 4th `Promise.all` call to `submitOptionsAnalysis`; handle `options_skipped`; propagate top-level `force` to all axes |
| `src/application/overall/submitOverallAnalysis.ts` | Modify | Include options result in `inputHash`; pass options + `optionsOiStale` to prompt builder |
| `src/domain/analysis/overallPrompt.ts` | Modify | Extend signature with options + `optionsOiStale`; emit `optionsBulletsKo` field + rename `integratedConclusionKo`; handle skipped/stale hints |
| `src/domain/analysis/normalizeOverall.ts` | Modify | Validate `optionsBulletsKo`, `integratedConclusionKo`; echo `optionsOiStale` from caller-supplied input |
| `src/__tests__/application/overall/pickNearestExpiration.test.ts` | Create | Helper unit tests |
| `src/__tests__/application/overall/dependencyResolver.test.ts` | Modify | Add 4-axis scenarios |
| `src/__tests__/application/overall/submitOverallAnalysis.test.ts` | Modify | Add cache-key + prompt-builder integration scenarios |
| `src/__tests__/domain/analysis/overallPrompt.test.ts` | Modify | Add 4-axis schema + rename + stale-hint cases |
| `src/__tests__/domain/analysis/normalizeOverall.test.ts` | Modify | Add `optionsBulletsKo`, `integratedConclusionKo`, `optionsOiStale` cases |
| `dist/` | Build output | Synced to app `node_modules` between phases (rsync) |

### siglens app changes

| File | Action | Responsibility |
|---|---|---|
| `src/components/overall/hooks/useOverallAnalysis.ts` | Modify | Extend `AXIS_ORDER`, `pollDependencyJob` switch, `getPageHideJobs` map, unmount cleanup; pass `force=true` when re-triggering |
| `src/infrastructure/market/submitOverallAnalysisAction.ts` | Modify | Add `force` param; fetch options snapshot; compute `optionsOiStale`; forward `optionsSnapshot`/`options`/`optionsOiStale`/`force` to core |
| `src/infrastructure/options/fetchOptionsSnapshot.ts` | Create (if not present) | Server-side wrapper reusing `YahooOptionsAdapter`/`optionsDataCache` for the overall axis call |
| `src/components/overall/sections/OptionsSummary.tsx` | Create | New 4th-axis section; stale badge; empty/NoChains branch |
| `src/components/overall/sections/IntegratedConclusion.tsx` | Create | Renamed component (replaces `ThreeAxisConclusion.tsx`); heading text "통합 결론" |
| `src/components/overall/sections/ThreeAxisConclusion.tsx` | Delete | Replaced by `IntegratedConclusion.tsx` |
| `src/components/overall/ReanalyzeButton.tsx` | Create | Re-analyze CTA; `highlighted` prop changes styling; no rate-cost copy |
| `src/components/overall/OverallContent.tsx` | Modify | Insert OptionsSummary after TechnicalSummary; swap conclusion component; render ReanalyzeButton |
| `src/components/overall/utils/buildChatState.ts` | Modify | Include `optionsBulletsKo`; rename conclusion field reference |
| `src/app/[symbol]/overall/page.tsx` | Modify | Update SEO copy/FAQ to mention 4 axes + sentiment |
| `src/__tests__/components/overall/hooks/useOverallAnalysis.test.ts` | Modify | Add 4-axis polling, cleanup, force-trigger tests |
| `src/__tests__/components/overall/OverallContent.test.tsx` | Modify | Add OptionsSummary placement, IntegratedConclusion rename, re-analyze button tests |
| `src/__tests__/components/overall/sections/OptionsSummary.test.tsx` | Create | Section rendering + stale + empty branches |
| `src/__tests__/components/overall/ReanalyzeButton.test.tsx` | Create | Button states |
| `src/__tests__/components/overall/utils/buildChatState.test.ts` | Modify | New fields |
| `src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts` | Modify | Snapshot fetch + stale + NoChains + force |

---

## Phase 2 — Worktree Setup

### Task 1: Create worktrees in both repos

**Files:** None directly — git worktree side effects only.

- [ ] **Step 1: Create siglens-core worktree**

```bash
git -C /Users/y0ngha/Project/siglens-core worktree add \
    /Users/y0ngha/Project/siglens-core-overall-options \
    -b feat/overall-options-axis main
```

Expected: New directory `/Users/y0ngha/Project/siglens-core-overall-options` exists with branch `feat/overall-options-axis` checked out.

- [ ] **Step 2: Create siglens app worktree**

```bash
git -C /Users/y0ngha/Project/siglens worktree add \
    /Users/y0ngha/Project/siglens-overall-options \
    -b feat/overall-options-axis master
```

Expected: New directory `/Users/y0ngha/Project/siglens-overall-options` exists with branch `feat/overall-options-axis` checked out.

- [ ] **Step 3: Verify yarn install state in both worktrees**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options && yarn install --check-files
cd /Users/y0ngha/Project/siglens-overall-options && yarn install --check-files
```

Expected: No package changes (both are clean copies of their parents).

---

## Phase 3 — Hard Bottleneck: Core Type Surface + Sync (Single Track)

This phase must complete before Phase 4 starts. It's small (~5-10 min) so it's not worth parallelizing.

### Task 2: Core type surface + initial build + sync to app

**Files:**
- Modify: `siglens-core-overall-options/src/application/overall/types.ts`
- Modify: `siglens-core-overall-options/src/domain/types.ts`

- [ ] **Step 1: Extend `OverallAxis` union**

Edit `src/application/overall/types.ts`. Find:

```typescript
export type OverallAxis = 'technical' | 'fundamental' | 'news';
```

Replace with:

```typescript
export type OverallAxis = 'technical' | 'fundamental' | 'news' | 'options';
```

- [ ] **Step 2: Add options + force fields to `OverallDependencyInputs`**

In the same file, inside `OverallDependencyInputs`, after the `news` field block, add:

```typescript
    /**
     * Pre-fetched options snapshot. Caller fetches via OptionsDataProvider
     * (or app-side adapter). Omit (or set undefined) to skip the options axis
     * gracefully — the resolver returns kind: 'options_skipped' and the
     * prompt builder receives a null options context.
     */
    optionsSnapshot?: import('@/domain/types').OptionsSnapshot;

    /**
     * Per-axis options forwarded verbatim to `submitOptionsAnalysis`.
     * Mirrors the technical/fundamental/news per-axis option fields.
     * `expirationDate` is computed by the resolver via pickNearestExpiration —
     * do not set it here.
     */
    options?: Pick<
        import('@/application/options/types').SubmitOptionsAnalysisOptions,
        'usage' | 'tier' | 'tierConfig' | 'modelId' | 'userApiKey' | 'waitUntil'
    >;

    /**
     * OI snapshot staleness marker. Forwarded to the prompt as a hint and
     * echoed back on `OverallAnalysisResponse.optionsOiStale` so the UI can
     * show a stale badge. Computed by the caller (app side) using
     * isOpenInterestSnapshotStale + isUsOptionsRegularSession.
     */
    optionsOiStale?: boolean;

    /**
     * Top-level force flag. When true, the resolver forwards `force: true` to
     * every axis submit call (computed as `topLevel.force ?? axis.force ?? false`).
     * Used by the re-analyze button in the app, which performs a 4-axis full
     * refresh. Per-axis `force` (e.g. `technical.force`) remains supported
     * for backward compatibility; the OR-style precedence means either layer
     * setting `true` triggers a force refresh on that axis.
     */
    force?: boolean;
```

- [ ] **Step 3: Add `OverallAnalysisResponse` + `RawOverallAnalysisResponse` fields**

Edit `src/domain/types.ts`. Find the existing `OverallAnalysisResponse` interface and modify to:

```typescript
export interface OverallAnalysisResponse {
    headlineKo: string;
    technicalBulletsKo: string[];
    fundamentalBulletsKo: string[];
    newsBulletsKo: string[];
    optionsBulletsKo: string[];
    integratedConclusionKo: string;
    scenarios: OverallScenario[];
    riskFactorsKo: string[];
    /** OI snapshot staleness marker echoed from caller input. */
    optionsOiStale?: boolean;
}
```

Find `RawOverallAnalysisResponse` and modify to:

```typescript
export interface RawOverallAnalysisResponse {
    headlineKo?: unknown;
    technicalBulletsKo?: unknown;
    fundamentalBulletsKo?: unknown;
    newsBulletsKo?: unknown;
    optionsBulletsKo?: unknown;
    integratedConclusionKo?: unknown;
    scenarios?: unknown;
    riskFactorsKo?: unknown;
}
```

Note: do NOT keep the old `threeAxisConclusionKo` field — cache invalidation policy is "no backward compat" (spec §2.3).

- [ ] **Step 4: Run typecheck to find downstream type errors (do NOT fix them yet)**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn tsc --noEmit 2>&1 | head -50
```

Expected: Multiple errors in `dependencyResolver.ts`, `submitOverallAnalysis.ts`, `overallPrompt.ts`, `normalizeOverall.ts` referencing the removed/renamed fields. These are addressed in Phase 4-Core tasks.

- [ ] **Step 5: Build core, ignoring failures from downstream code that Phase 4 fixes**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn build 2>&1 | tail -30
```

If the build fails on `dependencyResolver.ts` etc., add minimal `// @ts-expect-error options axis WIP` comments at the lines that reference axis-specific code (only in `dependencyResolver.ts` and `submitOverallAnalysis.ts`) to unblock the build. These will be removed in Phase 4 tasks.

Alternatively, run a type-only build that skips full validation:

```bash
yarn tsc --emitDeclarationOnly -p tsconfig.build.json 2>&1 | tail -30
```

Expected: `dist/` is regenerated with new type definitions (`.d.ts` files reflect new fields).

- [ ] **Step 6: Sync core dist to siglens app worktree**

```bash
rsync -a --delete \
    /Users/y0ngha/Project/siglens-core-overall-options/dist/ \
    /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/
```

Expected: No errors. The app's `node_modules/@y0ngha/siglens-core/dist/application/overall/types.d.ts` now contains the extended `OverallAxis` union.

- [ ] **Step 7: Verify app sees new types**

```bash
grep "options" /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/application/overall/types.d.ts | head -5
```

Expected: Output includes `OverallAxis = 'technical' | 'fundamental' | 'news' | 'options'` and `optionsSnapshot?:` field declarations.

- [ ] **Step 8: Commit Phase 3 in core worktree**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
git add src/application/overall/types.ts src/domain/types.ts
git commit -m "feat(overall): extend OverallAxis with 'options' + response/inputs type surface"
```

---

## Phase 4-Core — Parallel Track A (siglens-core)

These tasks run in `/Users/y0ngha/Project/siglens-core-overall-options`. They are independent of Phase 4-App tasks. Implementer subagent A handles all of these.

### Task 3 (Core): `pickNearestExpiration` helper + tests

**Files:**
- Create: `src/application/overall/pickNearestExpiration.ts`
- Create: `src/__tests__/application/overall/pickNearestExpiration.test.ts`

- [ ] **Step 1: Write failing test**

`src/__tests__/application/overall/pickNearestExpiration.test.ts`:

```typescript
import { pickNearestExpiration } from '@/application/overall/pickNearestExpiration';
import type { OptionsSnapshot, OptionsChain } from '@/domain/types';

function makeChain(date: string): OptionsChain {
    return {
        expirationDate: date,
        calls: [],
        puts: [],
        // other OptionsChain fields can be empty for the helper's logic
    } as OptionsChain;
}

function makeSnapshot(dates: string[]): OptionsSnapshot {
    return {
        symbol: 'AAPL',
        underlyingPrice: 100,
        chains: dates.map(makeChain),
        capturedAt: '2026-05-22T13:30:00Z',
    };
}

describe('pickNearestExpiration', () => {
    const now = new Date('2026-05-22T12:00:00Z');

    it('picks earliest expiration ≥ now + 3 days', () => {
        const snap = makeSnapshot([
            '2026-05-23', // +1d — skipped
            '2026-05-24', // +2d — skipped
            '2026-05-26', // +4d — picked
            '2026-06-02', // +11d
        ]);
        expect(pickNearestExpiration(snap, now)).toBe('2026-05-26');
    });

    it('falls back to earliest expiration ≥ now when all are within 3 days', () => {
        const snap = makeSnapshot(['2026-05-23', '2026-05-24']);
        expect(pickNearestExpiration(snap, now)).toBe('2026-05-23');
    });

    it('skips past expirations', () => {
        const snap = makeSnapshot(['2026-05-20', '2026-05-21', '2026-05-26']);
        expect(pickNearestExpiration(snap, now)).toBe('2026-05-26');
    });

    it('returns null when chains is empty', () => {
        const snap = makeSnapshot([]);
        expect(pickNearestExpiration(snap, now)).toBeNull();
    });

    it('returns null when all expirations are in the past', () => {
        const snap = makeSnapshot(['2026-05-20', '2026-05-21']);
        expect(pickNearestExpiration(snap, now)).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn jest src/__tests__/application/overall/pickNearestExpiration.test.ts
```

Expected: FAIL with "Cannot find module" or similar.

- [ ] **Step 3: Implement helper**

`src/application/overall/pickNearestExpiration.ts`:

```typescript
import type { OptionsSnapshot } from '@/domain/types';

const PREFERRED_MIN_DAYS = 3;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pick the nearest expiration that's ≥ `now + 3 days` to avoid 0DTE/near-expiry
 * noise (gamma blow-ups, single-event distortions). If every available
 * expiration is within 3 days, fall back to the earliest one ≥ `now`. Returns
 * null when no future expiration exists (NoChains-like edge).
 *
 * `snapshot.chains` is documented as ascending-sorted by `expirationDate`, so
 * we scan once and return the first hit per branch.
 */
export function pickNearestExpiration(
    snapshot: OptionsSnapshot,
    now: Date
): string | null {
    const nowMs = now.getTime();
    const preferredMinMs = nowMs + PREFERRED_MIN_DAYS * MS_PER_DAY;

    let earliestFuture: string | null = null;
    for (const chain of snapshot.chains) {
        const ms = Date.parse(chain.expirationDate);
        if (Number.isNaN(ms)) continue;
        if (ms < nowMs) continue;
        if (earliestFuture === null) earliestFuture = chain.expirationDate;
        if (ms >= preferredMinMs) return chain.expirationDate;
    }
    return earliestFuture;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
yarn jest src/__tests__/application/overall/pickNearestExpiration.test.ts
```

Expected: All 5 cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/application/overall/pickNearestExpiration.ts src/__tests__/application/overall/pickNearestExpiration.test.ts
git commit -m "feat(overall): add pickNearestExpiration helper with 0DTE avoidance"
```

---

### Task 4 (Core): Extend `dependencyResolver` for options axis

**Files:**
- Modify: `src/application/overall/dependencyResolver.ts`
- Modify: `src/__tests__/application/overall/dependencyResolver.test.ts`

- [ ] **Step 1: Add `DependencyState` options-skipped variant**

Edit `src/application/overall/types.ts`. Locate the `DependencyState` union and add the new variant.

```typescript
// In types.ts, add to DependencyState union:
// ... existing variants ...
| { kind: 'cached'; technical: AnalysisResponse; fundamental: FundamentalAnalysisResponse; news: NewsAnalysisResponse; options: OptionsAnalysisResponse | null }
| { kind: 'pending'; pendingJobs: Record<OverallAxis, string | undefined> }
| { kind: 'error'; axis: OverallAxis; error: ... }
| { kind: 'miss_no_trigger' }
```

Add the `options: OptionsAnalysisResponse | null` field to the `cached` variant. `null` indicates the axis was gracefully skipped (NoChains or no snapshot provided).

- [ ] **Step 2: Write failing test for options-skipped path**

In `src/__tests__/application/overall/dependencyResolver.test.ts`, add:

```typescript
describe('resolveOverallDependencies — options axis', () => {
    it('returns options: null when optionsSnapshot is undefined', async () => {
        const inputs = makeBaseInputs({ optionsSnapshot: undefined });
        const state = await resolveOverallDependencies(inputs);
        expect(state.kind).toBe('cached');
        if (state.kind === 'cached') {
            expect(state.options).toBeNull();
        }
    });

    it('returns options: null when submitOptionsAnalysis returns no_chains_error', async () => {
        // stub submitOptionsAnalysis to return { status: 'no_chains_error', ... }
        mockSubmitOptions.mockResolvedValueOnce({
            status: 'no_chains_error',
            code: 'no_options_chains',
            error: 'No options chains available',
        });
        const inputs = makeBaseInputs({ optionsSnapshot: makeEmptySnapshot() });
        const state = await resolveOverallDependencies(inputs);
        expect(state.kind).toBe('cached');
        if (state.kind === 'cached') {
            expect(state.options).toBeNull();
        }
    });

    it('surfaces options limit_error like other axis errors', async () => {
        mockSubmitOptions.mockResolvedValueOnce({
            status: 'limit_error',
            code: 'usage_limit_exceeded',
            error: { code: 'usage_limit_exceeded', message: 'limit' },
        });
        const inputs = makeBaseInputs({ optionsSnapshot: makeSnapshot() });
        const state = await resolveOverallDependencies(inputs);
        expect(state.kind).toBe('error');
        if (state.kind === 'error') {
            expect(state.axis).toBe('options');
        }
    });

    it('includes options jobId in pendingJobs when submitted', async () => {
        mockSubmitOptions.mockResolvedValueOnce({
            status: 'submitted',
            jobId: 'opt-123',
        });
        const inputs = makeBaseInputs({ optionsSnapshot: makeSnapshot() });
        const state = await resolveOverallDependencies(inputs);
        expect(state.kind).toBe('pending');
        if (state.kind === 'pending') {
            expect(state.pendingJobs.options).toBe('opt-123');
        }
    });

    it('drops options.usage when dropAxisUsage is true', async () => {
        await resolveOverallDependencies(
            makeBaseInputs({
                optionsSnapshot: makeSnapshot(),
                options: { usage: { userId: 'u', symbol: 'AAPL' } as any, modelId: 'claude-sonnet-4-6' },
            }),
            { dropAxisUsage: true }
        );
        expect(mockSubmitOptions).toHaveBeenCalledWith(
            expect.not.objectContaining({ usage: expect.anything() })
        );
    });

    it('forwards top-level force to all 4 axes', async () => {
        await resolveOverallDependencies(
            makeBaseInputs({ optionsSnapshot: makeSnapshot(), force: true })
        );
        // technical force: positional arg 3
        expect(mockSubmitAnalysis).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), expect.anything(),
            true, expect.anything(), expect.anything()
        );
        expect(mockSubmitFundamental).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
        expect(mockSubmitNews).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
        expect(mockSubmitOptions).toHaveBeenCalledWith(
            expect.objectContaining({ force: true })
        );
    });
});
```

(Use the existing test file's setup helpers — extend them with options snapshot mock, `mockSubmitOptions`, etc.)

- [ ] **Step 2a: Run tests to verify they fail**

```bash
yarn jest src/__tests__/application/overall/dependencyResolver.test.ts
```

Expected: FAIL — implementation not yet there.

- [ ] **Step 3: Implement options axis branch in resolver**

Edit `src/application/overall/dependencyResolver.ts`. Add imports:

```typescript
import { submitOptionsAnalysis } from '@/application/options/submitOptionsAnalysis';
import { pickNearestExpiration } from '@/application/overall/pickNearestExpiration';
import type { OptionsAnalysisResponse } from '@/domain/types';
```

In `resolveOverallDependencies`, destructure new fields after the existing destructuring:

```typescript
const {
    // ... existing destructured fields ...
    optionsSnapshot,
    options: optionsAxisOptions,
    optionsOiStale,
    force: topLevelForce,
} = inputs;
```

Compute effective per-axis force:

```typescript
const effectiveForce = {
    technical: topLevelForce ?? technicalForce ?? false,
    // fundamental/news/options previously had no axis-level force; with the
    // top-level field they pick it up directly:
    fundamental: topLevelForce ?? false,
    news: topLevelForce ?? false,
    options: topLevelForce ?? false,
};
```

Compute options axis options (with optional usage drop):

```typescript
const optionsAxisOptionsResolved =
    dropAxisUsage && optionsAxisOptions !== undefined
        ? omitUsage(optionsAxisOptions)
        : optionsAxisOptions;
```

Replace the `Promise.all([...3 axes...])` block with 4 axes. Add a 4th entry:

```typescript
const optionsExpirationDate =
    optionsSnapshot !== undefined
        ? pickNearestExpiration(optionsSnapshot, new Date())
        : null;

const optionsSubmit = (optionsSnapshot !== undefined && optionsExpirationDate !== null)
    ? submitOptionsAnalysis({
          symbol,
          companyName,
          modelId,
          snapshot: optionsSnapshot,
          expirationDate: optionsExpirationDate,
          tier: topLevelTier ?? DEFAULT_TIER,
          userApiKey: topLevelUserApiKey,
          ...optionsAxisOptionsResolved,
          force: effectiveForce.options,
          skipEnqueueIfMiss: topLevelSkipEnqueueIfMiss,
      })
    : Promise.resolve({ status: 'no_chains_error', code: 'no_options_chains', error: 'No snapshot' } as const);

const [technicalResult, fundamentalResult, newsResult, optionsResult] = await Promise.all([
    submitAnalysis(symbol, companyName, timeframe, effectiveForce.technical, technicalFmpSymbol, { /* existing tech options */ }),
    submitFundamentalAnalysis({ /* existing fundamental options */, force: effectiveForce.fundamental }),
    submitNewsAnalysis({ /* existing news options */, force: effectiveForce.news }),
    optionsSubmit,
]);
```

Add options-axis error checks alongside existing ones:

```typescript
if (optionsResult.status === 'error' || optionsResult.status === 'key_error' || optionsResult.status === 'limit_error') {
    return { kind: 'error', axis: 'options', error: optionsResult };
}
```

Handle graceful skip for `no_chains_error` (does NOT return early; treated as null payload):

```typescript
const optionsPayload: OptionsAnalysisResponse | null =
    optionsResult.status === 'cached' ? optionsResult.result
  : optionsResult.status === 'no_chains_error' ? null
  : /* submitted */ null; // pending path handled below
```

Extend `miss_no_trigger` check to include options:

```typescript
if (
    technicalResult.status === 'miss_no_trigger' ||
    fundamentalResult.status === 'miss_no_trigger' ||
    newsResult.status === 'miss_no_trigger' ||
    optionsResult.status === 'miss_no_trigger'
) {
    return { kind: 'miss_no_trigger' };
}
```

Extend `pending` branch to include `options` in `pendingJobs`:

```typescript
const anyPending =
    technicalResult.status === 'submitted' ||
    fundamentalResult.status === 'submitted' ||
    newsResult.status === 'submitted' ||
    optionsResult.status === 'submitted';

if (anyPending) {
    return {
        kind: 'pending',
        pendingJobs: {
            technical: technicalResult.status === 'submitted' ? technicalResult.jobId : undefined,
            fundamental: fundamentalResult.status === 'submitted' ? fundamentalResult.jobId : undefined,
            news: newsResult.status === 'submitted' ? newsResult.jobId : undefined,
            options: optionsResult.status === 'submitted' ? optionsResult.jobId : undefined,
        },
    };
}
```

Extend the `cached` branch to include the `options` payload:

```typescript
return {
    kind: 'cached',
    technical: technicalResult.result,
    fundamental: fundamentalResult.result,
    news: newsResult.result,
    options: optionsPayload,
};
```

- [ ] **Step 4: Run resolver tests to verify pass**

```bash
yarn jest src/__tests__/application/overall/dependencyResolver.test.ts
```

Expected: All cases PASS (existing 3-axis + new options cases).

- [ ] **Step 5: Commit**

```bash
git add src/application/overall/dependencyResolver.ts src/application/overall/types.ts src/__tests__/application/overall/dependencyResolver.test.ts
git commit -m "feat(overall): integrate options axis into dependency resolver (skipped/pending/error paths)"
```

---

### Task 5 (Core): Update `submitOverallAnalysis` for options input hash + prompt call

**Files:**
- Modify: `src/application/overall/submitOverallAnalysis.ts`
- Modify: `src/__tests__/application/overall/submitOverallAnalysis.test.ts`

- [ ] **Step 1: Write failing test for new cache key behaviour**

In `src/__tests__/application/overall/submitOverallAnalysis.test.ts`, add:

```typescript
describe('submitOverallAnalysis — options axis integration', () => {
    it('includes options input in cache key so cached overall keys differ before/after the change', async () => {
        // Submit twice with identical inputs except options snapshot presence
        const baseInputs = makeBaseInputs();
        const result1 = await submitOverallAnalysis({ ...baseInputs, optionsSnapshot: undefined });
        const result2 = await submitOverallAnalysis({ ...baseInputs, optionsSnapshot: makeNonTrivialSnapshot() });

        // Both should miss-cache and submit (different keys) — assertion via spy on getCache
        expect(getCachedSpy).toHaveBeenCalledTimes(2);
        const [[key1], [key2]] = getCachedSpy.mock.calls;
        expect(key1).not.toBe(key2);
    });

    it('passes optionsOiStale through to prompt builder', async () => {
        await submitOverallAnalysis({ ...makeBaseInputs(), optionsSnapshot: makeNonTrivialSnapshot(), optionsOiStale: true });
        expect(buildOverallAnalysisPromptSpy).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), expect.anything(),
            expect.anything(), expect.anything(), expect.anything(),
            expect.anything(), // fearGreed
            expect.anything(), // options
            true               // optionsOiStale
        );
    });
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
yarn jest src/__tests__/application/overall/submitOverallAnalysis.test.ts
```

Expected: FAIL (prompt signature mismatch + cache key not yet incorporating options).

- [ ] **Step 3: Update `submitOverallAnalysis.ts`**

In the cached branch after `resolveOverallDependencies` succeeds with `kind: 'cached'`, gather the input hash material. Find where `inputHash` is computed and add the options payload:

```typescript
// Existing: hash technical/fundamental/news payloads
// Add: options payload (may be null)
const inputHash = hash({
    technical: state.technical,
    fundamental: state.fundamental,
    news: state.news,
    options: state.options ?? null,        // NEW
    fearGreed: fearGreed ?? null,
});
```

In the prompt-builder call, pass `state.options` and `inputs.optionsOiStale`:

```typescript
const prompt = buildOverallAnalysisPrompt(
    symbol, companyName,
    state.technical, state.fundamental, state.news,
    timeframe,
    fearGreed ?? undefined,
    state.options ?? null,                  // NEW
    options.optionsOiStale ?? false         // NEW
);
```

- [ ] **Step 4: Run tests, verify pass**

```bash
yarn jest src/__tests__/application/overall/submitOverallAnalysis.test.ts
```

Expected: New tests PASS plus existing tests PASS (typecheck issues in the prompt-builder signature change resolve once Task 6 is done — for this task, scope the test to behaviour testable independently, or mark cross-task tests in Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/application/overall/submitOverallAnalysis.ts src/__tests__/application/overall/submitOverallAnalysis.test.ts
git commit -m "feat(overall): include options payload in input hash + pass to prompt"
```

---

### Task 6 (Core): Rename `threeAxisConclusionKo` → `integratedConclusionKo` + extend prompt for 4 axes

**Files:**
- Modify: `src/domain/analysis/overallPrompt.ts`
- Modify: `src/__tests__/domain/analysis/overallPrompt.test.ts`

- [ ] **Step 1: Update prompt-builder signature**

Edit `src/domain/analysis/overallPrompt.ts`. Modify the exported function signature:

```typescript
export function buildOverallAnalysisPrompt(
    symbol: string,
    companyName: string,
    technical: AnalysisResponse,
    fundamental: FundamentalAnalysisResponse,
    news: NewsAnalysisResponse,
    timeframe: Timeframe,
    fearGreed?: FearGreedSnapshot,
    options?: OptionsAnalysisResponse | null,    // NEW
    optionsOiStale?: boolean                      // NEW
): string {
    // ... body ...
}
```

- [ ] **Step 2: Update prompt body for 4-axis output schema**

Inside the JSON schema section of the prompt body, find the `threeAxisConclusionKo` mention and replace with `integratedConclusionKo`. Add an `optionsBulletsKo: string[]` field.

```
{
  "headlineKo": "...",
  "technicalBulletsKo": [...],
  "fundamentalBulletsKo": [...],
  "newsBulletsKo": [...],
  "optionsBulletsKo": [...],
  "integratedConclusionKo": "...",
  "scenarios": [...],
  "riskFactorsKo": [...]
}
```

Update the Korean instruction text accordingly: "세 축" → "네 축" wherever it appears.

- [ ] **Step 3: Add options-context section**

When `options === null`:

```
[옵션 시장]
이 종목의 옵션 시장 데이터는 분석에 포함되지 않았습니다 (옵션 미상장 또는 데이터 없음). optionsBulletsKo는 빈 배열로 유지하세요.
```

When `options` is provided:

```
[옵션 시장]
${options.toneKo} 톤. ${options.summaryKo}
주요 시그널:
- ...
```

When `optionsOiStale === true`, append:

```
주의: 미국 옵션 정규 거래 시간 외에 수집된 스냅샷으로, Open Interest가 직전 세션 기준일 수 있습니다.
```

- [ ] **Step 4: Update tests**

In `src/__tests__/domain/analysis/overallPrompt.test.ts`, add cases:

```typescript
it('includes optionsBulletsKo in the JSON schema', () => {
    const prompt = buildOverallAnalysisPrompt(/* args */);
    expect(prompt).toContain('optionsBulletsKo');
});

it('uses integratedConclusionKo not threeAxisConclusionKo', () => {
    const prompt = buildOverallAnalysisPrompt(/* args */);
    expect(prompt).toContain('integratedConclusionKo');
    expect(prompt).not.toContain('threeAxisConclusionKo');
});

it('includes "옵션 미상장" hint when options=null', () => {
    const prompt = buildOverallAnalysisPrompt(/* args */, null);
    expect(prompt).toContain('옵션 미상장');
});

it('includes stale OI hint when optionsOiStale=true', () => {
    const prompt = buildOverallAnalysisPrompt(/* args */, makeOptions(), true);
    expect(prompt).toContain('Open Interest가 직전 세션');
});
```

- [ ] **Step 5: Run prompt tests**

```bash
yarn jest src/__tests__/domain/analysis/overallPrompt.test.ts
```

Expected: All cases PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/analysis/overallPrompt.ts src/__tests__/domain/analysis/overallPrompt.test.ts
git commit -m "feat(overall): 4-axis prompt schema + integratedConclusionKo rename + options/stale hints"
```

---

### Task 7 (Core): Update `normalizeOverall` for 4-axis fields

**Files:**
- Modify: `src/domain/analysis/normalizeOverall.ts`
- Modify: `src/__tests__/domain/analysis/normalizeOverall.test.ts`

- [ ] **Step 1: Update normalizer**

Edit `src/domain/analysis/normalizeOverall.ts`. The normalizer currently validates `threeAxisConclusionKo` from `RawOverallAnalysisResponse`. Change to `integratedConclusionKo`:

```typescript
const integratedConclusionKo = ensureNonEmptyString(
    raw.integratedConclusionKo,
    'integratedConclusionKo'
);
```

Add `optionsBulletsKo` validation parallel to the other `*BulletsKo` fields:

```typescript
const optionsBulletsKo = ensureStringArray(raw.optionsBulletsKo, 'optionsBulletsKo', { fallback: [] });
```

Note: `fallback: []` because the LLM may legitimately produce an empty array when options=null was passed.

Update the function signature to accept and echo `optionsOiStale`:

```typescript
export function normalizeOverallAnalysisResponse(
    raw: RawOverallAnalysisResponse,
    context: { optionsOiStale?: boolean }
): OverallAnalysisResponse {
    // ...
    return {
        headlineKo,
        technicalBulletsKo,
        fundamentalBulletsKo,
        newsBulletsKo,
        optionsBulletsKo,
        integratedConclusionKo,
        scenarios,
        riskFactorsKo,
        ...(context.optionsOiStale ? { optionsOiStale: true } : {}),
    };
}
```

(If callers don't currently pass a context object, give it a sensible default `context: { optionsOiStale?: boolean } = {}` and update call sites.)

- [ ] **Step 2: Update callers**

Find every call to `normalizeOverallAnalysisResponse` in the core repo (likely in `pollOverallAnalysis.ts` and worker glue) and pass `{ optionsOiStale: jobMeta.optionsOiStale }`. The worker stores `optionsOiStale` alongside `cacheKey` in `setJobMeta`. Update `setJobMeta` calls in `submitOverallAnalysis.ts` to include it.

- [ ] **Step 3: Update tests**

Add to `src/__tests__/domain/analysis/normalizeOverall.test.ts`:

```typescript
it('validates optionsBulletsKo', () => {
    const raw = { ...validRaw, optionsBulletsKo: ['감마 상승'] };
    const result = normalizeOverallAnalysisResponse(raw);
    expect(result.optionsBulletsKo).toEqual(['감마 상승']);
});

it('falls back to empty array when optionsBulletsKo missing', () => {
    const raw = { ...validRaw, optionsBulletsKo: undefined };
    const result = normalizeOverallAnalysisResponse(raw);
    expect(result.optionsBulletsKo).toEqual([]);
});

it('echoes optionsOiStale=true when context provided', () => {
    const result = normalizeOverallAnalysisResponse(validRaw, { optionsOiStale: true });
    expect(result.optionsOiStale).toBe(true);
});

it('omits optionsOiStale field when context does not request it', () => {
    const result = normalizeOverallAnalysisResponse(validRaw, {});
    expect(result.optionsOiStale).toBeUndefined();
});

it('reads integratedConclusionKo (not threeAxisConclusionKo)', () => {
    const raw = { ...validRaw, integratedConclusionKo: '통합 결론' };
    const result = normalizeOverallAnalysisResponse(raw);
    expect(result.integratedConclusionKo).toBe('통합 결론');
});
```

- [ ] **Step 4: Run normalize tests**

```bash
yarn jest src/__tests__/domain/analysis/normalizeOverall.test.ts
```

Expected: All cases PASS.

- [ ] **Step 5: Run full core test suite for regressions**

```bash
yarn test
```

Expected: All PASS. Existing tests should not break — the rename and additions are localized.

- [ ] **Step 6: Commit**

```bash
git add src/domain/analysis/normalizeOverall.ts src/__tests__/domain/analysis/normalizeOverall.test.ts src/application/overall/submitOverallAnalysis.ts src/application/overall/pollOverallAnalysis.ts
git commit -m "feat(overall): normalize 4-axis response with integratedConclusionKo + optionsOiStale echo"
```

---

### Task 8 (Core): Final core build + sync to app

**Files:** Build output only.

- [ ] **Step 1: Run full build**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 2: Sync dist to app worktree**

```bash
rsync -a --delete \
    /Users/y0ngha/Project/siglens-core-overall-options/dist/ \
    /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/
```

- [ ] **Step 3: Verify exports**

```bash
grep "integratedConclusionKo\|optionsBulletsKo\|optionsOiStale" \
    /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/domain/types.d.ts | head -5
```

Expected: All three fields present.

- [ ] **Step 4: No commit needed (dist is built artifact, gitignored in app)**

---

## Phase 4-App — Parallel Track B (siglens app)

These tasks run in `/Users/y0ngha/Project/siglens-overall-options`. They begin after Phase 3 sync completes; they do NOT need to wait for Phase 4-Core completion (app uses the synced `dist` from Phase 3 type surface). They DO need a re-sync from Task 8 before Phase 5 verification.

Implementer subagent B handles all of these.

### Task 9 (App): Extend `submitOverallAnalysisAction` with options snapshot + OI stale + force

**Files:**
- Modify: `src/infrastructure/market/submitOverallAnalysisAction.ts`
- Create (if missing): `src/infrastructure/options/fetchOverallOptionsSnapshot.ts`
- Modify: `src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts`

- [ ] **Step 1: Check existing snapshot-fetch surface**

```bash
grep -rn "getOptionsSnapshot\|fetchOptions\|optionsDataCache" \
    /Users/y0ngha/Project/siglens-overall-options/src/infrastructure/options/ | head -10
```

Identify the cached server-side helper used by the options page (likely `optionsDataCache.ts`). Reuse it; only create a new wrapper file if a parameter-shape mismatch makes reuse awkward.

- [ ] **Step 2: Write failing test**

In `src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts`, add:

```typescript
it('passes optionsSnapshot + optionsOiStale to core', async () => {
    mockFetchSnapshot.mockResolvedValueOnce(makeSnapshot());
    mockIsRegularSession.mockReturnValueOnce(false);
    mockIsOiStale.mockReturnValueOnce(true);

    await submitOverallAnalysisAction('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6');

    expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
            optionsSnapshot: expect.any(Object),
            optionsOiStale: true,
        })
    );
});

it('passes optionsSnapshot=undefined for NoChains symbols', async () => {
    mockFetchSnapshot.mockResolvedValueOnce(null); // NoChains
    await submitOverallAnalysisAction('SPXUSD', 'S&P', '1Day', 'claude-sonnet-4-6');
    expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ optionsSnapshot: undefined })
    );
});

it('forwards force=true through to core', async () => {
    await submitOverallAnalysisAction('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6', { force: true });
    expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ force: true })
    );
});

it('does not force when called without options arg', async () => {
    await submitOverallAnalysisAction('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6');
    expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
        expect.not.objectContaining({ force: true })
    );
});

it('passes optionsOiStale=false during regular session even if snapshot stale', async () => {
    mockFetchSnapshot.mockResolvedValueOnce(makeSnapshot());
    mockIsRegularSession.mockReturnValueOnce(true); // in session
    mockIsOiStale.mockReturnValueOnce(true);        // stale would be true but session check gates

    await submitOverallAnalysisAction('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6');
    expect(mockSubmitOverallAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ optionsOiStale: false })
    );
});
```

- [ ] **Step 3: Run tests, verify fail**

```bash
cd /Users/y0ngha/Project/siglens-overall-options
yarn jest src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts
```

- [ ] **Step 4: Implement action changes**

Edit `src/infrastructure/market/submitOverallAnalysisAction.ts`. Update signature:

```typescript
export interface SubmitOverallAnalysisActionOptions {
    force?: boolean;
}

export async function submitOverallAnalysisAction(
    symbol: string,
    companyName: string,
    timeframe: Timeframe,
    modelId: SubmitOverallAnalysisOptions['modelId'],
    options: SubmitOverallAnalysisActionOptions = {}
): Promise<SubmitOverallAnalysisActionResult> {
    // ... existing logic ...
}
```

Add imports near the top:

```typescript
import { getOptionsSnapshotCached } from '@/infrastructure/options/optionsDataCache';
import {
    isUsOptionsRegularSession,
    isOpenInterestSnapshotStale,
} from '@/domain/market/session';
```

(Adjust the import path if the cached helper has a different name — verify in Step 1.)

In the `try` block, after the existing `Promise.all([rows, next])` block, add:

```typescript
const optionsSnapshot = await getOptionsSnapshotCached(symbol).catch(error => {
    console.warn('[submitOverallAnalysisAction] options snapshot fetch failed:', error);
    return null;
});

const optionsOiStale =
    optionsSnapshot !== null
    && !isUsOptionsRegularSession(new Date())
    && isOpenInterestSnapshotStale(optionsSnapshot);
```

Pass through to `submitOverallAnalysis`:

```typescript
return await submitOverallAnalysis({
    // ... existing fields ...
    optionsSnapshot: optionsSnapshot ?? undefined,
    optionsOiStale,
    ...(options.force ? { force: true } : {}),
});
```

- [ ] **Step 5: Run tests, verify pass**

```bash
yarn jest src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts
```

Expected: All cases PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/market/submitOverallAnalysisAction.ts src/__tests__/infrastructure/market/submitOverallAnalysisAction.test.ts
git commit -m "feat(overall): fetch options snapshot + stale check + force in server action"
```

---

### Task 10 (App): Extend `useOverallAnalysis` for 4 axes + force re-trigger

**Files:**
- Modify: `src/components/overall/hooks/useOverallAnalysis.ts`
- Modify: `src/__tests__/components/overall/hooks/useOverallAnalysis.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the hook test file:

```typescript
it('includes options in AXIS_ORDER and polls all 4 axes', async () => {
    // mock: technical+fundamental+news cached, options submitted with jobId
    mockSubmit.mockResolvedValueOnce({
        status: 'pending_dependencies',
        pendingJobs: { technical: undefined, fundamental: undefined, news: undefined, options: 'opt-1' },
    });
    mockPollOptions.mockResolvedValueOnce({ status: 'done' });
    mockSubmit.mockResolvedValueOnce({ status: 'submitted', jobId: 'overall-1' });
    mockPollOverall.mockResolvedValueOnce({ status: 'done', result: makeOverallResponse() });

    renderHook(() => useOverallAnalysis('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6'));
    act(() => result.current.trigger());

    await waitFor(() => expect(mockPollOptions).toHaveBeenCalledWith('opt-1'));
    await waitFor(() => expect(result.current.state.status).toBe('done'));
});

it('cancels options job on unmount', () => {
    mockSubmit.mockResolvedValueOnce({
        status: 'pending_dependencies',
        pendingJobs: { technical: undefined, fundamental: undefined, news: undefined, options: 'opt-1' },
    });
    const { unmount } = renderHook(() => useOverallAnalysis(/* ... */));
    act(() => result.current.trigger());
    unmount();
    expect(mockCancelOptions).toHaveBeenCalledWith('opt-1');
});

it('passes force=true to action on re-trigger after done', async () => {
    mockSubmit.mockResolvedValue({ status: 'cached', result: makeOverallResponse() });
    const { result } = renderHook(() => useOverallAnalysis(/* ... */));
    act(() => result.current.trigger());
    await waitFor(() => expect(result.current.state.status).toBe('done'));

    act(() => result.current.trigger()); // re-analyze
    await waitFor(() =>
        expect(mockSubmit).toHaveBeenLastCalledWith('AAPL', 'Apple', '1Day', 'claude-sonnet-4-6', { force: true })
    );
});
```

- [ ] **Step 2: Run tests, verify fail**

```bash
yarn jest src/__tests__/components/overall/hooks/useOverallAnalysis.test.ts
```

- [ ] **Step 3: Update `AXIS_ORDER` + switch**

In `src/components/overall/hooks/useOverallAnalysis.ts`:

```typescript
const AXIS_ORDER: readonly OverallAxis[] = ['technical', 'fundamental', 'news', 'options'];
```

```typescript
async function pollDependencyJob(
    axis: OverallAxis,
    jobId: string
): Promise<DependencyPollResult> {
    switch (axis) {
        case 'technical': return pollAnalysisAction(jobId);
        case 'fundamental': return pollFundamentalAnalysisAction(jobId);
        case 'news': return pollNewsAnalysisAction(jobId);
        case 'options': return pollOptionsAnalysisAction(jobId);
    }
}
```

Add import:

```typescript
import { pollOptionsAnalysisAction, cancelOptionsAnalysisJobAction } from '@/infrastructure/options/optionsActions';
```

- [ ] **Step 4: Extend `getPageHideJobs` + unmount cleanup**

In `getPageHideJobs`, add:

```typescript
...(current.jobs.options !== undefined
    ? [{ jobId: current.jobs.options, type: 'options' as const }]
    : []),
```

In the unmount `useEffect`, add inside the `dependencies` branch:

```typescript
if (options !== undefined)
    void cancelOptionsAnalysisJobAction(options).catch(error =>
        console.warn('[useOverallAnalysis] cancel options failed', error)
    );
```

Where `options` is destructured alongside `technical/fundamental/news` from `current.jobs`.

- [ ] **Step 5: Force on re-trigger**

Update the queryFn to read a `force` flag from the closure:

```typescript
const queryFnRef = useRef<{ force: boolean }>({ force: false });
const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
        const force = queryFnRef.current.force;
        queryFnRef.current.force = false; // consume
        return fetchOverallAnalysis(
            symbol, companyName, timeframe, modelId, signal, setProgress, onJobsUpdate,
            { force }
        );
    },
    // ...
});

const trigger = useCallback(() => {
    setProgress(null);
    if (!triggered) {
        setTriggered(true);
    } else {
        queryFnRef.current.force = true;
        void refetch();
    }
}, [triggered, refetch]);
```

And update `fetchOverallAnalysis` + `submitUntilReady` to accept and forward `{ force }` into `submitOverallAnalysisAction`. The action signature change in Task 9 expects `{ force?: boolean }` as the 5th param.

- [ ] **Step 6: Run hook tests, verify pass**

```bash
yarn jest src/__tests__/components/overall/hooks/useOverallAnalysis.test.ts
```

Expected: All cases PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/overall/hooks/useOverallAnalysis.ts src/__tests__/components/overall/hooks/useOverallAnalysis.test.ts
git commit -m "feat(overall): polling/cancel/force for options axis in useOverallAnalysis"
```

---

### Task 11 (App): Rename `ThreeAxisConclusion` → `IntegratedConclusion` + update buildChatState

**Files:**
- Create: `src/components/overall/sections/IntegratedConclusion.tsx`
- Delete: `src/components/overall/sections/ThreeAxisConclusion.tsx`
- Modify: `src/components/overall/utils/buildChatState.ts`
- Modify: `src/__tests__/components/overall/utils/buildChatState.test.ts`

- [ ] **Step 1: Create new component file**

Copy `ThreeAxisConclusion.tsx` to `IntegratedConclusion.tsx` and modify:

```tsx
import { cn } from '@/lib/cn';

interface Props {
    text: string;
}

export function IntegratedConclusion({ text }: Props) {
    return (
        <section
            aria-labelledby="overall-integrated-conclusion-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <h2
                id="overall-integrated-conclusion-heading"
                className="mb-3 text-lg font-semibold text-balance"
            >
                통합 결론
            </h2>
            <p className={cn('text-secondary-200 whitespace-pre-wrap leading-relaxed')}>
                {text}
            </p>
        </section>
    );
}
```

- [ ] **Step 2: Update `buildChatState.ts`**

Replace `threeAxisConclusionKo` references with `integratedConclusionKo`:

```typescript
return {
    // ... existing fields ...
    optionsBulletsKo: r.optionsBulletsKo,                     // NEW
    integratedConclusionKo: r.integratedConclusionKo,         // RENAMED
};
```

And update the chat context's downstream consumer types if they explicitly type the conclusion field.

- [ ] **Step 3: Update buildChatState test**

In `buildChatState.test.ts`, add cases for `optionsBulletsKo` mapping and update the `threeAxisConclusionKo` → `integratedConclusionKo` expectation.

- [ ] **Step 4: Delete old `ThreeAxisConclusion.tsx`**

```bash
rm src/components/overall/sections/ThreeAxisConclusion.tsx
```

If there's a stale test file `src/__tests__/components/overall/sections/ThreeAxisConclusion.test.tsx`, delete it too.

- [ ] **Step 5: Run buildChatState tests**

```bash
yarn jest src/__tests__/components/overall/utils/buildChatState.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/overall/sections/IntegratedConclusion.tsx \
    src/components/overall/utils/buildChatState.ts \
    src/__tests__/components/overall/utils/buildChatState.test.ts
git rm src/components/overall/sections/ThreeAxisConclusion.tsx
git commit -m "refactor(overall): rename ThreeAxisConclusion → IntegratedConclusion + 4-axis chat state"
```

---

### Task 12 (App): New `OptionsSummary` section component

**Files:**
- Create: `src/components/overall/sections/OptionsSummary.tsx`
- Create: `src/__tests__/components/overall/sections/OptionsSummary.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { OptionsSummary } from '@/components/overall/sections/OptionsSummary';

describe('OptionsSummary', () => {
    it('renders bullets', () => {
        render(<OptionsSummary bullets={['감마 상승', '풋콜 비율 1.2']} oiStale={false} />);
        expect(screen.getByText('감마 상승')).toBeInTheDocument();
        expect(screen.getByText('풋콜 비율 1.2')).toBeInTheDocument();
    });

    it('shows "분석 대상 옵션 없음" when bullets is empty', () => {
        render(<OptionsSummary bullets={[]} oiStale={false} />);
        expect(screen.getByText(/분석 대상 옵션 없음/)).toBeInTheDocument();
    });

    it('shows stale badge when oiStale=true', () => {
        render(<OptionsSummary bullets={['감마 상승']} oiStale={true} />);
        expect(screen.getByText(/OI 데이터 stale/)).toBeInTheDocument();
    });

    it('does not show stale badge when oiStale=false', () => {
        render(<OptionsSummary bullets={['감마 상승']} oiStale={false} />);
        expect(screen.queryByText(/OI 데이터 stale/)).not.toBeInTheDocument();
    });

    it('does not show stale badge when bullets empty (no analysis happened)', () => {
        render(<OptionsSummary bullets={[]} oiStale={true} />);
        expect(screen.queryByText(/OI 데이터 stale/)).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Verify failure**

```bash
yarn jest src/__tests__/components/overall/sections/OptionsSummary.test.tsx
```

- [ ] **Step 3: Implement component**

```tsx
interface Props {
    bullets: string[];
    oiStale: boolean;
}

export function OptionsSummary({ bullets, oiStale }: Props) {
    const isEmpty = bullets.length === 0;
    return (
        <section
            aria-labelledby="overall-options-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-3 flex items-center gap-2">
                <h2
                    id="overall-options-heading"
                    className="text-lg font-semibold text-balance"
                >
                    옵션 시장
                </h2>
                {!isEmpty && oiStale && (
                    <span
                        className="rounded-md bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300"
                        title="미국 옵션 정규 거래 시간 외에 수집된 스냅샷으로, Open Interest가 직전 세션 기준일 수 있습니다."
                    >
                        OI 데이터 stale
                    </span>
                )}
            </div>
            {isEmpty ? (
                <p className="text-secondary-400 text-sm">
                    분석 대상 옵션 없음 (옵션 미상장 또는 데이터 없음)
                </p>
            ) : (
                <ul className="text-secondary-200 list-disc space-y-2 pl-5 leading-relaxed">
                    {bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                    ))}
                </ul>
            )}
        </section>
    );
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
yarn jest src/__tests__/components/overall/sections/OptionsSummary.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/overall/sections/OptionsSummary.tsx \
    src/__tests__/components/overall/sections/OptionsSummary.test.tsx
git commit -m "feat(overall): add OptionsSummary section with stale badge + empty branch"
```

---

### Task 13 (App): `ReanalyzeButton` + `OverallContent` integration

**Files:**
- Create: `src/components/overall/ReanalyzeButton.tsx`
- Create: `src/__tests__/components/overall/ReanalyzeButton.test.tsx`
- Modify: `src/components/overall/OverallContent.tsx`
- Modify: `src/__tests__/components/overall/OverallContent.test.tsx`

- [ ] **Step 1: Write ReanalyzeButton test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ReanalyzeButton } from '@/components/overall/ReanalyzeButton';

describe('ReanalyzeButton', () => {
    it('renders 재분석 label', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={false} />);
        expect(screen.getByRole('button', { name: /재분석/ })).toBeInTheDocument();
    });

    it('calls onClick when clicked', () => {
        const handler = jest.fn();
        render(<ReanalyzeButton onClick={handler} highlighted={false} />);
        fireEvent.click(screen.getByRole('button'));
        expect(handler).toHaveBeenCalled();
    });

    it('applies highlighted style when highlighted=true', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={true} />);
        const btn = screen.getByRole('button');
        expect(btn.className).toMatch(/ring-amber|bg-amber/);
    });

    it('does not show rate-cost copy', () => {
        render(<ReanalyzeButton onClick={() => {}} highlighted={false} />);
        expect(screen.queryByText(/한도|차감|rate/i)).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Implement button**

```tsx
interface Props {
    onClick: () => void;
    highlighted: boolean;
}

export function ReanalyzeButton({ onClick, highlighted }: Props) {
    return (
        <div className="flex justify-center pt-2">
            <button
                type="button"
                onClick={onClick}
                className={
                    highlighted
                        ? 'rounded-md bg-amber-900/30 px-4 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-900/40 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none'
                        : 'border-secondary-600 bg-secondary-800 text-secondary-200 hover:bg-secondary-700 focus-visible:ring-primary-400 rounded-md border px-4 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none'
                }
            >
                재분석
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Run button tests, verify pass**

```bash
yarn jest src/__tests__/components/overall/ReanalyzeButton.test.tsx
```

- [ ] **Step 4: Modify `OverallContent.tsx`**

Find the `done` rendering block and update:

```tsx
import { OptionsSummary } from '@/components/overall/sections/OptionsSummary';
import { IntegratedConclusion } from '@/components/overall/sections/IntegratedConclusion';
import { ReanalyzeButton } from '@/components/overall/ReanalyzeButton';

// ...

if (state.status !== 'done') return null;

const r = state.result;
return (
    <div className="space-y-6">
        <OverallSummary headline={r.headlineKo} />
        <TechnicalSummary bullets={r.technicalBulletsKo} />
        <OptionsSummary
            bullets={r.optionsBulletsKo}
            oiStale={r.optionsOiStale ?? false}
        />
        <FundamentalSummary bullets={r.fundamentalBulletsKo} />
        <NewsSummary bullets={r.newsBulletsKo} />
        <IntegratedConclusion text={r.integratedConclusionKo} />
        <ScenarioAnalysis scenarios={r.scenarios} />
        <RiskFactors factors={r.riskFactorsKo} />
        <ReanalyzeButton
            onClick={trigger}
            highlighted={(r.optionsBulletsKo.length > 0) && (r.optionsOiStale ?? false)}
        />
    </div>
);
```

Remove the old `ThreeAxisConclusion` import.

- [ ] **Step 5: Update OverallContent test**

In `OverallContent.test.tsx`, add cases:

```tsx
it('renders OptionsSummary between TechnicalSummary and FundamentalSummary', () => {
    // assertion: getByText(/기술적 분석/), getByText(/옵션 시장/), getByText(/펀더멘털/) order
});

it('renders IntegratedConclusion (not ThreeAxisConclusion)', () => {
    render(/* done state */);
    expect(screen.getByRole('heading', { name: /통합 결론/ })).toBeInTheDocument();
});

it('renders ReanalyzeButton on done', () => {
    render(/* done state */);
    expect(screen.getByRole('button', { name: /재분석/ })).toBeInTheDocument();
});

it('highlights ReanalyzeButton when options bullets present and OI stale', () => {
    render(/* done with options + oiStale=true */);
    const btn = screen.getByRole('button', { name: /재분석/ });
    expect(btn.className).toMatch(/amber/);
});

it('does not highlight ReanalyzeButton when options bullets empty', () => {
    render(/* done with bullets=[] + oiStale=true */);
    const btn = screen.getByRole('button', { name: /재분석/ });
    expect(btn.className).not.toMatch(/amber/);
});
```

- [ ] **Step 6: Run OverallContent tests**

```bash
yarn jest src/__tests__/components/overall/OverallContent.test.tsx
```

- [ ] **Step 7: Commit**

```bash
git add src/components/overall/ReanalyzeButton.tsx \
    src/__tests__/components/overall/ReanalyzeButton.test.tsx \
    src/components/overall/OverallContent.tsx \
    src/__tests__/components/overall/OverallContent.test.tsx
git commit -m "feat(overall): add OptionsSummary + ReanalyzeButton to OverallContent (4-axis layout)"
```

---

### Task 14 (App): Update SEO/FAQ copy in overall page

**Files:**
- Modify: `src/app/[symbol]/overall/page.tsx`

- [ ] **Step 1: Update the page guide and FAQ blocks**

In `src/app/[symbol]/overall/page.tsx`, the existing guide mentions "네 가지 축" referring to chart/fundamentals/news/fear-greed. Update to:

- Guide intro: "차트의 추세와 주요 지지선/저항선, 옵션 시장이 평가하는 단기 방향성, 분기 실적 흐름, 최근 뉴스 분위기까지 네 가지 분석 축에 시장 분위기를 더해 살펴봅니다."
- Add a sentence: "옵션 시장이 가까운 만기에서 콜/풋 어느 쪽에 더 큰 베팅을 걸고 있는지도 한 줄로 짚어 줍니다."
- Update FAQ Q1 to mention 4-axis explicitly.

(Exact wording is at the implementer's discretion within the spec constraints; preserve existing JSON-LD structure.)

- [ ] **Step 2: Verify build**

```bash
yarn build 2>&1 | tail -20
```

Expected: Build succeeds without complaints about the modified page.

- [ ] **Step 3: Commit**

```bash
git add src/app/[symbol]/overall/page.tsx
git commit -m "docs(overall): update SEO guide + FAQ to mention 4 analysis axes"
```

---

## Phase 5 — Integration Verification

### Task 15: Final core build + sync + manual app verification

**Files:** Build output + manual checks.

- [ ] **Step 1: Final core build**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
yarn build
```

Expected: Build succeeds.

- [ ] **Step 2: Run full core test suite**

```bash
yarn test
```

Expected: All PASS.

- [ ] **Step 3: Re-sync to app worktree**

```bash
rsync -a --delete \
    /Users/y0ngha/Project/siglens-core-overall-options/dist/ \
    /Users/y0ngha/Project/siglens-overall-options/node_modules/@y0ngha/siglens-core/dist/
```

- [ ] **Step 4: Run full app test suite**

```bash
cd /Users/y0ngha/Project/siglens-overall-options
yarn test
```

Expected: All PASS.

- [ ] **Step 5: Run app typecheck**

```bash
yarn tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Run app lint**

```bash
yarn lint
```

Expected: No new lint errors.

- [ ] **Step 7: Manual smoke test**

```bash
yarn dev
```

Then in a browser:
1. Visit `http://localhost:4200/AAPL/overall` → trigger analysis → verify all 4 sections render (Technical → Options → Fundamental → News → Integrated Conclusion → Scenarios → Risk).
2. Visit `http://localhost:4200/SPXUSD/overall` → trigger analysis → verify "분석 대상 옵션 없음" appears in OptionsSummary, other sections render normally.
3. Outside US market regular session (e.g. early morning KST), visit `/AAPL/overall` → verify "OI 데이터 stale" badge appears on OptionsSummary and ReanalyzeButton has amber highlight.
4. Click ReanalyzeButton → verify polling restarts and all 4 axes are force-refreshed (check network tab for fresh API calls).

Document any UI regressions for follow-up before opening PRs.

- [ ] **Step 8: No commit needed (verification only)**

---

## Phase 6 — Open PRs in Parallel

### Task 16: Open both PRs simultaneously, cross-link

**Files:** Git push + GitHub PR side effects.

- [ ] **Step 1: Push core branch**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
git push -u origin feat/overall-options-axis
```

- [ ] **Step 2: Push app branch**

```bash
cd /Users/y0ngha/Project/siglens-overall-options
git push -u origin feat/overall-options-axis
```

- [ ] **Step 3: Open core PR**

```bash
cd /Users/y0ngha/Project/siglens-core-overall-options
gh pr create --title "feat(overall): promote options to 4th dependency axis" --body "$(cat <<'EOF'
## Summary

Adds `'options'` as the 4th `OverallAxis` alongside `'technical' | 'fundamental' | 'news'`. The overall analysis prompt now reasons over options market positioning (nearest non-0DTE expiration) and emits `optionsBulletsKo`. Conclusion field renamed from `threeAxisConclusionKo` → `integratedConclusionKo`.

### Changes

- `OverallAxis` union extended with `'options'`
- `OverallDependencyInputs`: new fields `optionsSnapshot`, `options`, `optionsOiStale`, and top-level `force` (4-axis full refresh; `topLevel.force ?? axis.force ?? false`)
- `OverallAnalysisResponse`: new fields `optionsBulletsKo`, optional `optionsOiStale`; `threeAxisConclusionKo` → `integratedConclusionKo`
- `dependencyResolver` integrates `submitOptionsAnalysis`, picks nearest expiration via new helper `pickNearestExpiration` (≥ today+3d, 0DTE avoidance), gracefully skips on NoChains or absent snapshot
- `overallPrompt` schema 4-axis + Korean stale OI hint
- `normalizeOverall` validates `optionsBulletsKo`, `integratedConclusionKo`, echoes caller-supplied `optionsOiStale`

### Regression risk

- **All existing `/[symbol]/overall` caches are invalidated** by the new `inputHash` (which now includes the options payload). Cached results will rebuild on the next request per symbol/timeframe/model.

### Companion PR

Companion app PR: y0ngha/siglens#<APP_PR_NUMBER> — open in parallel; **merge order: this PR → publish → app PR**.

### Publish note

`@y0ngha/siglens-core` version bump and npm publish will be performed by @y0ngha after this PR is merged. Sequence: **merge core → publish core → merge app**.

## Test plan

- [ ] `yarn test` passes (4-axis unit + integration suites)
- [ ] `yarn build` succeeds
- [ ] Sample manual snapshot: AAPL + SPXUSD overall analyses behave per spec (verified in companion app PR)
EOF
)"
```

Capture the printed PR URL for cross-linking.

- [ ] **Step 4: Open app PR**

```bash
cd /Users/y0ngha/Project/siglens-overall-options
gh pr create --title "feat(overall): integrate options as 4th analysis axis in UI + hook" --body "$(cat <<'EOF'
## Summary

Promotes the options analysis to the 4th axis of `/[symbol]/overall`. Adds an `OptionsSummary` section between Technical and Fundamental, an always-visible `ReanalyzeButton` (highlighted when OI is stale), and updates SEO copy. Companion to siglens-core PR for the underlying types/resolver changes.

### Changes

- `useOverallAnalysis`: `AXIS_ORDER` includes `'options'`, switch handles `pollOptionsAnalysisAction`, unmount/pagehide cancel covers options, re-trigger passes `force=true` (4-axis full refresh)
- `submitOverallAnalysisAction`: fetches options snapshot, computes `optionsOiStale` from `isOpenInterestSnapshotStale` + `isUsOptionsRegularSession`, forwards `optionsSnapshot`/`optionsOiStale`/`force` to core
- New components: `OptionsSummary`, `IntegratedConclusion` (renamed from `ThreeAxisConclusion`), `ReanalyzeButton`
- `buildChatState`: includes `optionsBulletsKo`, uses `integratedConclusionKo`
- SEO/FAQ: mentions 4 axes + sentiment context

### Regression risk

- **All existing `/[symbol]/overall` caches are invalidated** by core's new `inputHash` (which now includes options). This PR depends on the companion core PR + new core publish.

### Companion PR

Companion core PR: y0ngha/siglens-core#<CORE_PR_NUMBER> — open in parallel; **merge order: core PR → publish → this PR**.

### Publish note

`@y0ngha/siglens-core` version bump and npm publish will be performed by @y0ngha. Do not merge this PR until the new core version is published. Sequence: **merge core → publish core → merge app**.

## Test plan

- [ ] `yarn test` passes (hook + section + action suites)
- [ ] `yarn lint` and `yarn tsc --noEmit` clean
- [ ] Manual smoke test (per plan §15 Step 7): AAPL/SPXUSD overall pages, OI stale badge outside regular session, ReanalyzeButton force-refresh
EOF
)"
```

- [ ] **Step 5: Edit both PR bodies to insert cross-link URLs**

Once both PRs are open, edit each PR body and replace `<CORE_PR_NUMBER>` and `<APP_PR_NUMBER>` with the actual numbers.

```bash
gh pr edit <CORE_PR_NUMBER> --body "$(updated body with app URL)"
gh pr edit <APP_PR_NUMBER> --body "$(updated body with core URL)"
```

- [ ] **Step 6: Report PR URLs to user**

Print both PR URLs to the user and remind them of the publish-then-merge sequence.

---

## Self-Review Checklist (run after completing all tasks)

When all 16 tasks are checked off, perform this review:

- [ ] Spec §2 (9 decisions): every decision has a corresponding implementation task
  - NoChains: Task 4 graceful skip path
  - Daily limit: Task 4 `dropAxisUsage` includes options
  - Cache invalidation: Task 5 includes options in `inputHash`
  - Axis fail: Task 4 surfaces options error like other axes
  - UI order: Task 13 places OptionsSummary after TechnicalSummary
  - Conclusion rename: Tasks 6, 7, 11, 13 cover prompt + normalizer + component + chat state
  - Nearest expiration: Task 3 + Task 4 use `pickNearestExpiration`
  - OI stale: Task 9 (action) + Task 12 (badge) + Task 13 (button highlight)
  - Re-analyze button: Task 13 component + Task 10 force-trigger
- [ ] Spec §3 every core change: implemented in Tasks 2-7
- [ ] Spec §4 every app change: implemented in Tasks 9-14
- [ ] No placeholders (`TBD`, `TODO`, `fill in`)
- [ ] Every code-changing step shows the actual code
- [ ] Type signatures consistent across tasks (e.g. `integratedConclusionKo` everywhere, `OverallDependencyInputs.force` consistent)
- [ ] All commit commands name the specific files modified, not `git add .`
- [ ] Tests precede implementation in every TDD task

---

## Notes for the Implementer

- This plan deliberately splits work across two repos. Phase 4-Core and Phase 4-App can run in parallel after Phase 3 syncs the new type surface to the app's `node_modules`.
- Whenever core types change in a non-trivial way during Phase 4-Core, re-run `yarn build` + the rsync command from Phase 3 Step 6 / Phase 5 Step 3 to keep the app worktree in sync. The implementer subagent for Phase 4-Core should add a small `scripts/sync-to-app.sh` if helpful.
- The `pickNearestExpiration` helper lives in `application/overall/`, not `domain/` — the date-vs-snapshot decision is an application concern.
- Cache invalidation is intentional and noted in both PRs. Do not add a backward-compat shim for `threeAxisConclusionKo`.
