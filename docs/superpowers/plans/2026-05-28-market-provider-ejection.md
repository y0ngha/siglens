# Market Data Provider Ejection (core → siglens) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all external market-data `fetch()` out of `@y0ngha/siglens-core` into the `siglens` app, leaving core with only the `MarketDataProvider` port; core use-cases receive the provider via explicit injection.

**Architecture:** Two sequential phases across two repos. **Phase A** (in `../siglens-core`) converts the 5 market use-cases to accept an injected `MarketDataProvider`, deletes the FMP/Alpaca fetch implementations + factory, and splits the market/worker config. **The user then publishes core to npm** (Claude does NOT publish). **Phase B** (in `siglens`) implements `FmpMarketProvider` on top of the existing `fmpGet` HTTP client, exposes a single construction point, and injects it at the 5 server-action call sites — also removing the now-redundant `BARS_FMP_RETRY` wrapper.

**Tech Stack:** TypeScript, vitest (both repos), Next.js 16 Server Actions (siglens), FSD layers (siglens). Spec: `docs/superpowers/specs/2026-05-28-market-provider-ejection-design.md`.

**Confirmed decisions:** explicit injection (leaf fns = first positional param; `submit*` = options field) · reuse `fmpGet` · remove Alpaca · `readFmpConfig` stays in core · **user performs npm publish**.

---

## File Structure

### Phase A — `../siglens-core`

| File | Change | Responsibility |
|---|---|---|
| `src/application/market/barsApi.ts` | modify | `fetchBarsWithIndicators(provider, …)` |
| `src/application/dashboard/getMarketSummary.ts` | modify | `getMarketSummary(provider)` |
| `src/application/dashboard/getMarketSummaryWithBriefing.ts` | modify | `getMarketSummaryWithBriefing(provider, options?)` |
| `src/application/dashboard/sectorSignals.ts` | modify | `getSectorSignals(provider, …)` |
| `src/application/market/submitAnalysis.ts` | modify | thread `options.marketDataProvider` → fetchBars |
| `src/application/market/types.ts` | modify | `SubmitAnalysisOptions.marketDataProvider` |
| `src/application/overall/submitOverallAnalysis.ts` | modify | thread `options.marketDataProvider` → fetchBars |
| `src/application/overall/types.ts` | modify | `SubmitOverallAnalysisOptions.marketDataProvider` |
| `src/infrastructure/market/fmp.ts` | **delete** | FMP fetch impl |
| `src/infrastructure/market/alpaca.ts` | **delete** | Alpaca fetch impl |
| `src/infrastructure/market/factory.ts` | **delete** | `createMarketDataProvider` |
| `src/infrastructure/market/config.ts` | modify | remove `readMarketProviderType`/`readAlpacaConfig`; keep worker config |
| `src/infrastructure/market/types.ts` | modify | remove `AlpacaConfig`/`MarketDataProviderType`; keep `WorkerConfig`/`AcquireReanalyzeCooldownResult` |
| `src/index.ts` | modify | remove `createMarketDataProvider` export |
| `src/__tests__/infrastructure/market/{fmp,alpaca,factory}.test.ts` | **delete** | |
| `src/__tests__/infrastructure/market/config.test.ts` | modify | drop alpaca/provider-type cases |
| `src/__tests__/application/market/barsApi.test.ts` | modify | inject fake provider |
| `src/__tests__/application/dashboard/getMarketSummary.test.ts` | modify | inject fake provider |
| `src/__tests__/application/dashboard/sectorSignals.test.ts` | modify | inject fake provider |
| submitAnalysis / submitOverallAnalysis tests | modify | pass `marketDataProvider` in options |

### Phase B — `siglens`

| File | Change | Responsibility |
|---|---|---|
| `src/shared/api/fmp/FmpMarketProvider.ts` | **create** | `MarketDataProvider` impl over `fmpGet` |
| `src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts` | **create** | provider unit tests |
| `src/shared/api/market/getMarketDataProvider.ts` | **create** | single construction point |
| `src/entities/bars/actions/getBarsAction.ts` | modify | inject provider; drop `BARS_FMP_RETRY` |
| `src/entities/bars/lib/barsRetry.ts` | **delete** | redundant after fmpGet retry |
| `src/entities/bars/__tests__/barsRetry.test.ts` | **delete** | |
| `src/entities/market-summary/actions/getMarketSummaryAction.ts` | modify | inject provider |
| `src/entities/sector-signal/actions/getSectorSignalsAction.ts` | modify | inject provider |
| `src/entities/analysis/actions/submitAnalysisAction.ts` | modify | options `marketDataProvider` |
| `src/entities/analysis/actions/submitOverallAnalysisAction.ts` | modify | options `marketDataProvider` |
| `package.json` | modify | bump `@y0ngha/siglens-core` |

---

# PHASE A — siglens-core

> All Phase A tasks run in `../siglens-core`. Commands assume that cwd.
> Per core repo conventions, route commits through its own flow.

## Task A1: Inject provider into `fetchBarsWithIndicators` + thread to submit\* use-cases

**Files:**
- Modify: `src/application/market/barsApi.ts`
- Modify: `src/application/market/types.ts`
- Modify: `src/application/market/submitAnalysis.ts:270-274,291-294`
- Modify: `src/application/overall/types.ts`
- Modify: `src/application/overall/submitOverallAnalysis.ts:302-306`
- Test: `src/__tests__/application/market/barsApi.test.ts`

- [ ] **Step 1: Update barsApi test to inject a fake provider**

Replace the factory mock with a fake provider object passed as the first argument. In `src/__tests__/application/market/barsApi.test.ts`, remove lines:

```ts
import { createMarketDataProvider } from '@/infrastructure/market/factory';
vi.mock('@/infrastructure/market/factory');
```

and the `beforeEach` body that does `(createMarketDataProvider as Mock).mockReturnValue({ getBars: mockGetBars })`. Replace with a fake provider and update every call:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

const mockGetBars = vi.fn();
const fakeProvider: MarketDataProvider = {
    getBars: mockGetBars,
    getQuote: vi.fn().mockResolvedValue(null),
};

beforeEach(() => {
    mockGetBars.mockReset();
});

// every call site becomes:
const result = await fetchBarsWithIndicators(fakeProvider, 'AAPL', '1Day');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/__tests__/application/market/barsApi.test.ts`
Expected: FAIL — `fetchBarsWithIndicators` still has the old `(symbol, timeframe, …)` signature, so passing `fakeProvider` as `symbol` produces wrong calls / type errors.

- [ ] **Step 3: Change `fetchBarsWithIndicators` to accept the provider**

In `src/application/market/barsApi.ts`, remove the factory import (`import { createMarketDataProvider } from '@/infrastructure/market/factory';`) and add the port type import. Change the signature and body:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';
// ...
export async function fetchBarsWithIndicators(
    provider: MarketDataProvider,
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string,
    now = new Date()
): Promise<BarsData> {
    const fromDay = computeFromDay(timeframe, now);
    const limit = TIMEFRAME_BARS_LIMIT[timeframe];
    const bars = await provider.getBars({
        symbol: fmpSymbol ?? symbol,
        timeframe,
        limit,
        from: fromDay,
    });
    const indicators = calculateIndicators(bars);
    return { bars, indicators };
}
```

Also delete the `@see createMarketDataProvider` line and the "selected via `createMarketDataProvider`" sentence from the JSDoc.

- [ ] **Step 4: Add `marketDataProvider` to `SubmitAnalysisOptions`**

In `src/application/market/types.ts`, add the import and the required field:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

export interface SubmitAnalysisOptions extends BackgroundTaskOptions {
    /** Market data provider injected by the consumer (siglens app). */
    marketDataProvider: MarketDataProvider;
    // ...existing fields unchanged
}
```

- [ ] **Step 5: Thread the provider through `submitAnalysis`**

In `src/application/market/submitAnalysis.ts`, update both `fetchBarsWithIndicators` calls to pass `options.marketDataProvider` first:

```ts
// line ~270
const { bars, indicators } = await fetchBarsWithIndicators(
    options.marketDataProvider,
    symbol,
    timeframe,
    fmpSymbol
);
// line ~294
const dailyDataPromise =
    timeframe === '1Day'
        ? Promise.resolve({ bars, indicators })
        : fetchBarsWithIndicators(
              options.marketDataProvider,
              symbol,
              '1Day',
              fmpSymbol
          );
```

- [ ] **Step 6: Add `marketDataProvider` to `SubmitOverallAnalysisOptions` + thread it**

In `src/application/overall/types.ts`, add (with the port import):

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

export interface SubmitOverallAnalysisOptions {
    /** Market data provider injected by the consumer (siglens app). */
    marketDataProvider: MarketDataProvider;
    // ...existing fields unchanged
}
```

In `src/application/overall/submitOverallAnalysis.ts:302`, update the call:

```ts
const fearGreed: FearGreedSnapshot | null = await fetchBarsWithIndicators(
    options.marketDataProvider,
    symbol,
    '1Day',
    fmpSymbol
)
```

- [ ] **Step 7: Update submitAnalysis / submitOverallAnalysis tests**

In the submitAnalysis test (`src/__tests__/application/market/submitAnalysis.test.ts`) and submitOverallAnalysis test, add a fake provider to every options object passed:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

const fakeProvider: MarketDataProvider = {
    getBars: vi.fn().mockResolvedValue([]),
    getQuote: vi.fn().mockResolvedValue(null),
};
// in each submitAnalysis(..., { ...opts }) call add: marketDataProvider: fakeProvider
// in each submitOverallAnalysis({ ... }) call add:    marketDataProvider: fakeProvider
```

If these tests previously relied on `vi.mock('@/infrastructure/market/factory')`, remove that mock (the provider is now injected, and `getBars` is faked above).

- [ ] **Step 8: Run the affected tests**

Run: `yarn test src/__tests__/application/market/ src/__tests__/application/overall/`
Expected: PASS.

- [ ] **Step 9: Typecheck**

Run: `yarn typecheck`
Expected: PASS (core still compiles — `getMarketSummary`/`getSectorSignals` continue to use the factory internally, which still exists).

- [ ] **Step 10: Commit**

```bash
git add src/application/market/barsApi.ts src/application/market/types.ts src/application/market/submitAnalysis.ts src/application/overall/types.ts src/application/overall/submitOverallAnalysis.ts src/__tests__/application/market src/__tests__/application/overall
git commit -m "refactor: inject MarketDataProvider into fetchBarsWithIndicators and submit use-cases"
```

## Task A2: Inject provider into dashboard use-cases

**Files:**
- Modify: `src/application/dashboard/getMarketSummary.ts`
- Modify: `src/application/dashboard/getMarketSummaryWithBriefing.ts`
- Modify: `src/application/dashboard/sectorSignals.ts`
- Test: `src/__tests__/application/dashboard/getMarketSummary.test.ts`, `src/__tests__/application/dashboard/sectorSignals.test.ts`

- [ ] **Step 1: Update getMarketSummary + sectorSignals tests to inject a fake provider**

In both test files, remove `vi.mock('@/infrastructure/market/factory')` and the `createMarketDataProvider` mock setup. Define a fake provider and pass it as the first argument:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

const mockGetQuote = vi.fn();
const mockGetBars = vi.fn();
const fakeProvider: MarketDataProvider = {
    getBars: mockGetBars,
    getQuote: mockGetQuote,
};
// getMarketSummary test:  await getMarketSummary(fakeProvider)
// sectorSignals test:     await getSectorSignals(fakeProvider, '1Day', now)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/__tests__/application/dashboard/getMarketSummary.test.ts src/__tests__/application/dashboard/sectorSignals.test.ts`
Expected: FAIL — signatures don't yet accept a provider.

- [ ] **Step 3: Change `getMarketSummary` to accept the provider**

In `src/application/dashboard/getMarketSummary.ts`, remove the factory import and change:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';
// ...
export async function getMarketSummary(
    provider: MarketDataProvider
): Promise<MarketSummaryData> {
    const quotes = await Promise.all(
        MARKET_SUMMARY_FMP_SYMBOLS.map(sym => provider.getQuote(sym))
    );
    // ...rest unchanged
}
```

- [ ] **Step 4: Thread the provider through `getMarketSummaryWithBriefing`**

In `src/application/dashboard/getMarketSummaryWithBriefing.ts`:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';

export async function getMarketSummaryWithBriefing(
    provider: MarketDataProvider,
    options?: BackgroundTaskOptions
): Promise<MarketSummaryWithBriefing> {
    const summary = await getMarketSummary(provider);
    const briefing = await submitBriefing(summary, options);
    return { summary, briefing };
}
```

- [ ] **Step 5: Change `getSectorSignals` to accept the provider**

In `src/application/dashboard/sectorSignals.ts`, remove the factory import and replace the internal construction with the parameter:

```ts
import type { MarketDataProvider } from '@/domain/ports/marketDataProvider';
// ...
export async function getSectorSignals(
    provider: MarketDataProvider,
    timeframe: DashboardTimeframe = DEFAULT_DASHBOARD_TIMEFRAME,
    now: Date = new Date()
): Promise<SectorSignalsResult> {
    const cache = createCacheProvider();
    // ...cache read unchanged...

    const fromIso = lookbackIsoFromNow(timeframe, now);
    const { barsResults, quoteResults } = await fetchBarsAndQuotes(
        provider,
        timeframe,
        fromIso
    );
    // ...rest unchanged
}
```

Delete the now-removed line `const provider = createMarketDataProvider();` and the `@throws {Error} If the market data provider cannot be constructed.` JSDoc lines in both `getMarketSummary` and `getSectorSignals`.

- [ ] **Step 6: Run the dashboard tests**

Run: `yarn test src/__tests__/application/dashboard/`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `yarn typecheck`
Expected: PASS. After this task NOTHING in core references `createMarketDataProvider`.

- [ ] **Step 8: Commit**

```bash
git add src/application/dashboard src/__tests__/application/dashboard
git commit -m "refactor: inject MarketDataProvider into dashboard use-cases"
```

## Task A3: Delete FMP/Alpaca providers, factory, and the public export

**Files:**
- Delete: `src/infrastructure/market/fmp.ts`, `src/infrastructure/market/alpaca.ts`, `src/infrastructure/market/factory.ts`
- Delete: `src/__tests__/infrastructure/market/fmp.test.ts`, `alpaca.test.ts`, `factory.test.ts`
- Modify: `src/index.ts:292`

- [ ] **Step 1: Delete the implementation + test files**

```bash
git rm src/infrastructure/market/fmp.ts src/infrastructure/market/alpaca.ts src/infrastructure/market/factory.ts
git rm src/__tests__/infrastructure/market/fmp.test.ts src/__tests__/infrastructure/market/alpaca.test.ts src/__tests__/infrastructure/market/factory.test.ts
```

- [ ] **Step 2: Remove the `createMarketDataProvider` export**

In `src/index.ts`, delete the line:

```ts
export { createMarketDataProvider } from './infrastructure/market/factory';
```

(Keep the `MarketDataProvider` / `GetBarsOptions` type exports from `./domain/ports/marketDataProvider` — they stay.)

- [ ] **Step 3: Typecheck + full test run**

Run: `yarn typecheck && yarn test`
Expected: PASS. `readMarketProviderType`/`readAlpacaConfig` are now unused but still defined (removed in A4) — that does not break compilation.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove core FMP/Alpaca fetch implementations and factory"
```

## Task A4: Split market/worker config + types (remove Alpaca + provider-type)

**Files:**
- Modify: `src/infrastructure/market/config.ts`
- Modify: `src/infrastructure/market/types.ts`
- Test: `src/__tests__/infrastructure/market/config.test.ts`

- [ ] **Step 1: Trim `config.test.ts`**

Remove the `describe` blocks / cases that exercise `readAlpacaConfig` and `readMarketProviderType`. Keep the `readWorkerConfig` / `tryReadWorkerConfig` cases. Remove their imports of the deleted functions.

- [ ] **Step 2: Remove the market-provider readers from `config.ts`**

In `src/infrastructure/market/config.ts`, delete `readAlpacaConfig` and `readMarketProviderType`. Keep `readWorkerConfig` and `tryReadWorkerConfig`. Update the type import line to drop `AlpacaConfig` and `MarketDataProviderType`:

```ts
import type { WorkerConfig } from '@/infrastructure/market/types';
```

- [ ] **Step 3: Remove the dead types**

In `src/infrastructure/market/types.ts`, delete `AlpacaConfig` and `MarketDataProviderType`. Keep `WorkerConfig` and `AcquireReanalyzeCooldownResult`.

- [ ] **Step 4: Typecheck + config test**

Run: `yarn typecheck && yarn test src/__tests__/infrastructure/market/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/market/config.ts src/infrastructure/market/types.ts src/__tests__/infrastructure/market/config.test.ts
git commit -m "refactor: drop Alpaca + market-provider config from core, keep worker config"
```

## Task A5: Full verification + build

- [ ] **Step 1: Build, typecheck, full test suite**

Run: `yarn build && yarn typecheck && yarn test`
Expected: all PASS. `git grep -n createMarketDataProvider src` returns nothing.

- [ ] **Step 2: Lint**

Run: `yarn lint`
Expected: PASS (no unused imports left behind).

> **GATE — user action:** After Phase A merges, **the user publishes the new core version to npm** (e.g. bump to `0.13.0`). Claude does NOT run `npm publish`. Phase B cannot start until the new version is published and its exact version string is known.

---

# PHASE B — siglens

> Phase B runs in the `siglens` repo. Requires the published core version from the gate above.

## Task B0: Bump the core dependency

**Files:** `package.json`

- [ ] **Step 1: Set the published version**

In `package.json`, change `"@y0ngha/siglens-core": "0.12.0"` to the version the user published (e.g. `"0.13.0"`).

- [ ] **Step 2: Install**

Run: `yarn install`
Expected: lockfile updates to the new core version.

- [ ] **Step 3: Confirm the breakage surface**

Run: `yarn typecheck`
Expected: FAIL with errors at the 5 server-action call sites and `getBarsAction` (signatures now require a provider / options field). This confirms the new core API is in place. These are fixed in B1–B3.

## Task B1: Create `FmpMarketProvider`

**Files:**
- Create: `src/shared/api/fmp/FmpMarketProvider.ts`
- Test: `src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: vi.fn(),
}));

import { fmpGet } from '@/shared/api/fmp/httpClient';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

const mockFmpGet = fmpGet as unknown as ReturnType<typeof vi.fn>;

describe('FmpMarketProvider', () => {
    const provider = new FmpMarketProvider();
    beforeEach(() => mockFmpGet.mockReset());

    it('maps intraday bars and reverses to ascending time', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { date: '2024-01-15 09:30:00', open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
        ]);
        const bars = await provider.getBars({ symbol: 'AAPL', timeframe: '5Min' });
        expect(mockFmpGet).toHaveBeenCalledWith('historical-chart/5min', { symbol: 'AAPL' });
        expect(bars).toHaveLength(1);
        expect(bars[0]!.open).toBe(1);
    });

    it('returns null from getQuote when fmpGet throws', async () => {
        mockFmpGet.mockRejectedValueOnce(new Error('boom'));
        expect(await provider.getQuote('AAPL')).toBeNull();
    });

    it('maps a quote', async () => {
        mockFmpGet.mockResolvedValueOnce([
            { price: 10, open: 9, dayHigh: 11, dayLow: 8, volume: 5, timestamp: 1700000000, changePercentage: 1.2, name: 'Apple' },
        ]);
        const q = await provider.getQuote('AAPL');
        expect(q).toEqual({ symbol: 'AAPL', price: 10, changesPercentage: 1.2, name: 'Apple' });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `yarn test src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts`
Expected: FAIL — `FmpMarketProvider` does not exist.

- [ ] **Step 3: Implement `FmpMarketProvider`**

Create `src/shared/api/fmp/FmpMarketProvider.ts`. Port the timestamp logic verbatim from core `fmp.ts`; replace each `fetch` with `fmpGet`; keep `getQuote`/today-quote null-on-failure:

```ts
import type {
    GetBarsOptions,
    MarketDataProvider,
    Bar,
    MarketQuote,
    Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';
import { fmpGet } from '@/shared/api/fmp/httpClient';

const ISO_DATE_PREFIX_LENGTH = 10; // "YYYY-MM-DD"

// FMP intraday timestamps are in America/New_York (ET), not UTC.
const EDT_OFFSET_HOURS = -4;
const EST_OFFSET_HOURS = -5;
const DST_START_MONTH = 3;
const DST_START_NTH_SUNDAY = 2;
const DST_END_MONTH = 11;
const DST_END_NTH_SUNDAY = 1;

const FMP_DATETIME_YEAR_END = 4;
const FMP_DATETIME_MONTH_START = 5;
const FMP_DATETIME_MONTH_END = 7;
const FMP_DATETIME_DAY_START = 8;
const FMP_DATETIME_DAY_END = 10;
const FMP_DATETIME_HOUR_START = 11;
const FMP_DATETIME_HOUR_END = 13;
const FMP_DATETIME_MINUTE_START = 14;
const FMP_DATETIME_MINUTE_END = 16;
const FMP_DATETIME_SECOND_START = 17;
const FMP_DATETIME_SECOND_END = 19;

function getNthSundayOfMonth(year: number, month: number, n: number): Date {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const dayOfWeek = firstOfMonth.getUTCDay();
    const firstSunday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    return new Date(Date.UTC(year, month - 1, firstSunday + (n - 1) * 7));
}

function getEtOffsetHours(year: number, month: number, day: number): number {
    const dstStart = getNthSundayOfMonth(year, DST_START_MONTH, DST_START_NTH_SUNDAY);
    const dstEnd = getNthSundayOfMonth(year, DST_END_MONTH, DST_END_NTH_SUNDAY);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date >= dstStart && date < dstEnd ? EDT_OFFSET_HOURS : EST_OFFSET_HOURS;
}

function fmpIntradayDateToUtcSeconds(dateStr: string): number {
    const year = Number(dateStr.substring(0, FMP_DATETIME_YEAR_END));
    const month = Number(dateStr.substring(FMP_DATETIME_MONTH_START, FMP_DATETIME_MONTH_END));
    const day = Number(dateStr.substring(FMP_DATETIME_DAY_START, FMP_DATETIME_DAY_END));
    const hour = Number(dateStr.substring(FMP_DATETIME_HOUR_START, FMP_DATETIME_HOUR_END));
    const minute = Number(dateStr.substring(FMP_DATETIME_MINUTE_START, FMP_DATETIME_MINUTE_END));
    const second = Number(dateStr.substring(FMP_DATETIME_SECOND_START, FMP_DATETIME_SECOND_END));
    const etOffsetHours = getEtOffsetHours(year, month, day);
    const utcMs = Date.UTC(year, month - 1, day, hour - etOffsetHours, minute, second);
    return Math.floor(utcMs / MS_PER_SECOND);
}

const FMP_INTRADAY_TIMEFRAME_MAP: Record<Exclude<Timeframe, '1Day'>, string> = {
    '5Min': '5min',
    '15Min': '15min',
    '30Min': '30min',
    '1Hour': '1hour',
    '4Hour': '4hour',
};

interface FmpBar { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface FmpDailyBar { date: string; open: number; high: number; low: number; close: number; volume: number; }
interface FmpQuote {
    price: number; open: number; dayHigh: number; dayLow: number;
    volume: number; timestamp: number; changePercentage: number; name: string;
}

function toFmpBar(raw: FmpBar): Bar {
    return {
        time: fmpIntradayDateToUtcSeconds(raw.date),
        open: raw.open, high: raw.high, low: raw.low, close: raw.close, volume: raw.volume,
    };
}

function toFmpDailyBar(raw: FmpDailyBar): Bar {
    return {
        time: Math.floor(new Date(raw.date + 'T00:00:00').getTime() / MS_PER_SECOND),
        open: raw.open, high: raw.high, low: raw.low, close: raw.close, volume: raw.volume,
    };
}

function buildBarsQuery(
    symbol: string,
    fromDate: string | undefined,
    endDate: string | undefined
): Record<string, string> {
    const query: Record<string, string> = { symbol };
    if (fromDate !== undefined) query.from = fromDate;
    if (endDate !== undefined) query.to = endDate;
    return query;
}

/**
 * FMP adapter for the core `MarketDataProvider` port. Fetches bars/quotes via
 * the shared `fmpGet` HTTP client (retry + structured FmpHttpError). Quote
 * failures degrade to `null`; bar failures propagate (after fmpGet's retries).
 */
export class FmpMarketProvider implements MarketDataProvider {
    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        const { symbol, timeframe, before, from } = options;
        const fromDate = from?.substring(0, ISO_DATE_PREFIX_LENGTH);
        const endDate = before?.substring(0, ISO_DATE_PREFIX_LENGTH);

        if (timeframe === '1Day') {
            return this.getDailyBars(symbol, fromDate, endDate);
        }
        const fmpTimeframe = FMP_INTRADAY_TIMEFRAME_MAP[timeframe as Exclude<Timeframe, '1Day'>];
        const raw = await fmpGet<FmpBar[]>(
            `historical-chart/${fmpTimeframe}`,
            buildBarsQuery(symbol, fromDate, endDate)
        );
        if (!Array.isArray(raw)) return [];
        return raw.map(r => toFmpBar(r)).toReversed();
    }

    private async getDailyBars(
        symbol: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): Promise<Bar[]> {
        const [raw, todayBar] = await Promise.all([
            fmpGet<FmpDailyBar[]>('historical-price-eod/full', buildBarsQuery(symbol, fromDate, endDate)),
            endDate === undefined ? this.fetchTodayQuoteBar(symbol) : Promise.resolve(null),
        ]);
        if (!Array.isArray(raw)) return [];
        const eodBars = raw.map(r => toFmpDailyBar(r)).toReversed();
        if (todayBar === null) return eodBars;
        const lastBar = eodBars.at(-1);
        if (lastBar !== undefined && lastBar.time >= todayBar.time) return eodBars;
        return [...eodBars, todayBar];
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        try {
            const raw = await fmpGet<FmpQuote[]>('quote', { symbol });
            if (!Array.isArray(raw) || raw.length === 0) return null;
            const quote = raw[0]!;
            return {
                symbol,
                price: quote.price,
                changesPercentage: quote.changePercentage,
                name: quote.name ?? symbol,
            };
        } catch (error) {
            console.warn('[FmpMarketProvider] getQuote failed:', symbol, error);
            return null;
        }
    }

    private async fetchTodayQuoteBar(symbol: string): Promise<Bar | null> {
        try {
            const raw = await fmpGet<FmpQuote[]>('quote', { symbol });
            if (!Array.isArray(raw) || raw.length === 0) return null;
            const quote = raw[0]!;
            const d = new Date(quote.timestamp * MS_PER_SECOND);
            const dateStr = d.toISOString().split('T')[0]!;
            return {
                time: Math.floor(new Date(dateStr + 'T00:00:00').getTime() / MS_PER_SECOND),
                open: quote.open, high: quote.dayHigh, low: quote.dayLow,
                close: quote.price, volume: quote.volume,
            };
        } catch (error) {
            console.warn('[FmpMarketProvider] today-quote fetch failed:', error);
            return null;
        }
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `yarn test src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/FmpMarketProvider.ts src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts
git commit -m "feat: add FmpMarketProvider implementing core MarketDataProvider over fmpGet"
```

## Task B2: Single construction point

**Files:** Create `src/shared/api/market/getMarketDataProvider.ts`

- [ ] **Step 1: Implement the helper**

```ts
import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

let cached: MarketDataProvider | null = null;

/** Returns the app's market data provider (FMP), constructed once and reused. */
export function getMarketDataProvider(): MarketDataProvider {
    cached ??= new FmpMarketProvider();
    return cached;
}
```

- [ ] **Step 2: Typecheck**

Run: `yarn typecheck`
Expected: still FAILs only at the 5 action call sites (fixed in B3) — the new module itself compiles.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/market/getMarketDataProvider.ts
git commit -m "feat: add getMarketDataProvider single construction point"
```

## Task B3: Inject at the 5 server actions + drop redundant bars retry

**Files:**
- Modify: `src/entities/bars/actions/getBarsAction.ts`
- Delete: `src/entities/bars/lib/barsRetry.ts`, `src/entities/bars/__tests__/barsRetry.test.ts`
- Modify: `src/entities/market-summary/actions/getMarketSummaryAction.ts`
- Modify: `src/entities/sector-signal/actions/getSectorSignalsAction.ts`
- Modify: `src/entities/analysis/actions/submitAnalysisAction.ts`
- Modify: `src/entities/analysis/actions/submitOverallAnalysisAction.ts`

- [ ] **Step 1: `getBarsAction` — inject provider, remove the retry wrapper**

Rewrite the body so `fmpGet`'s internal retry is the only retry layer:

```ts
'use server';

import {
    type BarsData,
    type Timeframe,
    fetchBarsWithIndicators,
} from '@y0ngha/siglens-core';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        return await fetchBarsWithIndicators(
            getMarketDataProvider(),
            symbol,
            timeframe,
            fmpSymbol
        );
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
```

- [ ] **Step 2: Delete the redundant retry shim**

```bash
git rm src/entities/bars/lib/barsRetry.ts src/entities/bars/__tests__/barsRetry.test.ts
```

- [ ] **Step 3: `getMarketSummaryAction` — inject provider**

```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
// ...
if (isBot(requestHeaders)) {
    const summary = await getMarketSummary(getMarketDataProvider());
    return { summary, briefing: null, botBlocked: true };
}
const result = await getMarketSummaryWithBriefing(getMarketDataProvider());
return { ...result, botBlocked: false };
```

- [ ] **Step 4: `getSectorSignalsAction` — inject provider**

```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
// ...
return await getSectorSignals(getMarketDataProvider(), timeframe);
```

- [ ] **Step 5: `submitAnalysisAction` — add to both options objects**

In both `submitAnalysis(...)` calls, add `marketDataProvider: getMarketDataProvider()` to the options object (alongside `waitUntil`, `modelId`, `skipEnqueueIfMiss`, …). Add the import:

```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
```

- [ ] **Step 6: `submitOverallAnalysisAction` — add to the options object**

In the `submitOverallAnalysis({ … })` call, add `marketDataProvider: getMarketDataProvider()` (next to `fundamentalProvider: new FmpFundamentalClient()`). Add the same import.

- [ ] **Step 7: Typecheck**

Run: `yarn typecheck`
Expected: PASS — all injection sites satisfied.

- [ ] **Step 8: Run the affected action tests**

Run: `yarn test src/entities/bars src/entities/market-summary src/entities/sector-signal src/entities/analysis`
Expected: PASS. (If any action test stubbed core market use-cases, update the stub call shapes to include the provider arg/field.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: inject FMP market provider at server actions, drop redundant bars retry"
```

## Task B4: Full verification

- [ ] **Step 1: Typecheck, full test, lint, build**

Run: `yarn typecheck && yarn test && yarn lint && yarn build`
Expected: all PASS.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `yarn dev` then load a symbol page and the `/market` dashboard. Confirm bars chart, market summary, and sector signals render with live data (FMP). Trigger an analysis to confirm `submitAnalysis` still fetches bars.

- [ ] **Step 3: Commit (if any smoke fixes)**

```bash
git add -A
git commit -m "fix: market provider injection smoke fixes"
```

---

## Self-Review

**Spec coverage:**
- §4.1 deletes → Task A3. §4.2 config/types split → A4. §4.4 leaf injection → A1 (fetchBars) + A2 (getMarketSummary/withBriefing/sectorSignals). §4.4 submit\* options → A1 (steps 4–6). §4.5 tests → A1/A2/A3/A4. §5.1 FmpMarketProvider → B1. §5.1 single construction point → B2. §5.2 five actions + BARS_FMP_RETRY removal → B3. §5.2 dep bump → B0. §6 sequencing + user publish → Phase gate. §7/§8 retry consolidation → B3 step 1–2.
- No spec requirement is left without a task.

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows real code; every run step shows a command + expected result.

**Type consistency:** `getMarketDataProvider()` used identically in B2/B3. `fetchBarsWithIndicators(provider, symbol, timeframe, fmpSymbol?, now?)` signature consistent across A1, B1-test, B3. `MarketDataProvider` import path `@y0ngha/siglens-core` (siglens) / `@/domain/ports/marketDataProvider` (core) consistent per repo. `marketDataProvider` options field name identical in A1/A2-types and B3/B5/B6.
