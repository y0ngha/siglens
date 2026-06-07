# Group A Remaining (Chandelier Exit + Parabolic SAR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `chandelierExit` (trend-colored dashed trailing-stop line) and `parabolicSar` (trend-colored dots) as price-pane overlays, finishing group A.

**Architecture:** Reuse the established overlay-hook pattern (`useSupertrendOverlay`/`useKeltnerOverlay`). Both indicators are trend-direction overlays drawn with two `LineSeries` (one per direction) because lightweight-charts has no per-point color. Generalize the existing `buildTrendSplitData` helper with a value-selector + generic trend literal so supertrend, parabolicSar, and chandelier all share it. Computation lives in `@y0ngha/siglens-core` (unchanged); this is pure siglens rendering.

**Tech Stack:** TypeScript, React 19 (`useEffectEvent`), lightweight-charts 5.2.0 (`pointMarkersVisible`, `LineStyle.Dashed`), Vitest + React Testing Library, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-render-group-a-rest-design.md`
**Branch:** `feat/render-group-a-rest` (base: `feat/render-supertrend` = PR #582)
**Worktree:** `/Users/y0ngha/Project/siglens-group-a-rest`

**Data shapes (siglens-core `domain/types.d.ts`):**
```ts
interface ParabolicSARResult { sar: number | null; trend: TrendDirection; }      // 'up' | 'down' | null
interface ChandelierResult  { longStop: number | null; shortStop: number | null; trend: ChandelierTrend | null; } // 'long' | 'short'
// IndicatorResult.parabolicSar: ParabolicSARResult[]
// IndicatorResult.chandelierExit: ChandelierResult[]
```

**Reference files (read before implementing):**
- `src/widgets/chart/hooks/useSupertrendOverlay.ts` — 2-series overlay hook skeleton (closest analog)
- `src/widgets/chart/hooks/useDonchianOverlay.ts` — `LineStyle.Dashed` import/usage example
- `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts` — hook test pattern

---

## File Structure

- `src/widgets/chart/utils/seriesDataUtils.ts` — generalize `buildTrendSplitData` (selector + generic Dir) (modify).
- `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts` — update existing buildTrendSplitData tests for new signature + add long/short cases (modify).
- `src/widgets/chart/hooks/useSupertrendOverlay.ts` — update 2 call sites to pass selector (modify).
- `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts` — update `toHaveBeenCalledWith` for 4th arg (modify).
- `src/shared/lib/chartColors.ts` + `src/app/globals.css` — 4 new colors + @theme tokens (modify).
- `src/widgets/chart/model/indicatorRegistry.ts` — `IndicatorKey` +2, registry +2 (modify).
- `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` — 27→29 + 2 assertions (modify).
- `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts` — makePaneIndices +2 (modify).
- `src/widgets/chart/hooks/useParabolicSarOverlay.ts` (+ test) — dots hook (create).
- `src/widgets/chart/hooks/useChandelierOverlay.ts` (+ test) — dashed stop hook (create).
- `src/widgets/chart/utils/overlayLabelUtils.ts` (+ tests) — 2 params + 2 configs with getColor (modify).
- `src/widgets/chart/StockChart.tsx` (+ test) — 2 hooks, 2 bindings, label-config params (modify).
- `e2e/specs/chart-indicators.spec.ts` — 2 modal-toggle tests (modify).

---

## Task 0: Worktree node_modules verify

**Files:** none (environment only)

- [ ] **Step 1: Verify the worktree has a real node_modules**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-a-rest
[ -e node_modules/.bin/vitest ] && [ ! -L node_modules ] && echo "OK: real node_modules present" || echo "MISSING"
```
Expected: `OK: real node_modules present`. If MISSING, run:
```bash
cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules && rm -rf node_modules/node_modules
```

- [ ] **Step 2: Sanity-check the toolchain**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`
Expected: PASS (9 tests).

---

## Task 1: Generalize `buildTrendSplitData`

**Files:**
- Modify: `src/widgets/chart/utils/seriesDataUtils.ts`
- Modify: `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`
- Modify: `src/widgets/chart/hooks/useSupertrendOverlay.ts`
- Modify: `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`

- [ ] **Step 1: Update the existing buildTrendSplitData tests to the new signature (test-first)**

In `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`, the `describe('buildTrendSplitData', ...)` block currently calls `buildTrendSplitData(bars, data, 'up')`. Add a 4th selector arg to every call and add long/short coverage. Replace the entire `describe('buildTrendSplitData', () => { ... })` block (lines ~142–192) with:

```ts
describe('buildTrendSplitData', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];
    const data: SupertrendResult[] = [
        { supertrend: 10, trend: 'up' },
        { supertrend: 11, trend: 'down' },
        { supertrend: null, trend: null },
    ];
    const getSt = (r: SupertrendResult): number | null => r.supertrend;

    it("returns value only on bars whose trend matches 'up', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'up', getSt)).toEqual([
            { time: 1, value: 10 },
            { time: 2 },
            { time: 3 },
        ]);
    });

    it("returns value only on bars whose trend matches 'down', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'down', getSt)).toEqual([
            { time: 1 },
            { time: 2, value: 11 },
            { time: 3 },
        ]);
    });

    it('up and down outputs are complementary on matched bars (never both have value)', () => {
        const up = buildTrendSplitData(bars, data, 'up', getSt);
        const down = buildTrendSplitData(bars, data, 'down', getSt);
        up.forEach((u, i) => {
            const bothHaveValue = 'value' in u && 'value' in down[i];
            expect(bothHaveValue).toBe(false);
        });
    });

    it('emits whitespace when the selected value is null even if trend matches dir', () => {
        const nullVal: SupertrendResult[] = [{ supertrend: null, trend: 'up' }];
        expect(buildTrendSplitData([bar(1)], nullVal, 'up', getSt)).toEqual([
            { time: 1 },
        ]);
    });

    it('clamps to the shorter of bars / data length (worst case)', () => {
        const longBars = [bar(1), bar(2), bar(3), bar(4)];
        const shortData: SupertrendResult[] = [{ supertrend: 5, trend: 'up' }];
        const out = buildTrendSplitData(longBars, shortData, 'up', getSt);
        expect(out).toEqual([{ time: 1, value: 5 }]);
    });

    it('returns empty array for empty inputs', () => {
        expect(buildTrendSplitData([], [], 'up', getSt)).toEqual([]);
    });

    it("supports a 'long'/'short' trend literal with a per-side selector (chandelier shape)", () => {
        const ch = [
            { longStop: 90, shortStop: 110, trend: 'long' as const },
            { longStop: 91, shortStop: 111, trend: 'short' as const },
        ];
        const longBars = [bar(1), bar(2)];
        expect(
            buildTrendSplitData(longBars, ch, 'long', r => r.longStop)
        ).toEqual([{ time: 1, value: 90 }, { time: 2 }]);
        expect(
            buildTrendSplitData(longBars, ch, 'short', r => r.shortStop)
        ).toEqual([{ time: 1 }, { time: 2, value: 111 }]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails (compile/signature mismatch)**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`
Expected: FAIL — the 4-arg calls don't match the current 3-arg signature (TS/runtime error), and the new long/short test fails.

- [ ] **Step 3: Generalize the helper**

In `src/widgets/chart/utils/seriesDataUtils.ts`, replace the entire `buildTrendSplitData` function (the JSDoc block + function, lines ~67–later) with:

```ts
/**
 * trend 방향이 dir과 일치하는 bar만 getValue(r) 값을, 나머지는 WhitespaceData({ time })를 반환한다.
 * 추세별 색 라인을 up/down(또는 long/short) 2개 LineSeries로 표현하기 위함(LineSeries는 per-point 색 미지원).
 * getValue 선택자와 제네릭 Dir로 supertrend·parabolicSar(단일 값 필드)와 chandelier(추세별 longStop/shortStop)를 모두 지원한다.
 */
export function buildTrendSplitData<Dir extends string, T extends { trend: Dir | null }>(
    bars: Bar[],
    data: T[],
    dir: Dir,
    getValue: (r: T) => number | null
): SeriesPoint[] {
    const count = Math.min(bars.length, data.length);
    return bars.slice(0, count).map((bar, i) => {
        const r = data[i];
        if (r && r.trend === dir) {
            const value = getValue(r);
            // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일하므로 safe-cast.
            if (value !== null) {
                return { time: bar.time as UTCTimestamp, value };
            }
        }
        return { time: bar.time as UTCTimestamp };
    });
}
```

The now-unused `SupertrendResult` import and `TrendDir` type alias in this file: leave them ONLY if still referenced. After this change `buildTrendSplitData` no longer references `SupertrendResult` or `TrendDir`. Remove `SupertrendResult` from the core import line and delete the `type TrendDir = Exclude<TrendDirection, null>;` line and its JSDoc — UNLESS `TrendDirection`/`SupertrendResult` are used elsewhere in the file (they are not). The core import becomes: `import type { Bar } from '@y0ngha/siglens-core';`. (tsc/lint in Step 5 will confirm no unused imports remain.)

- [ ] **Step 4: Update the supertrend hook call sites**

In `src/widgets/chart/hooks/useSupertrendOverlay.ts`, the data-sync effect calls `buildTrendSplitData(bars, supertrend, 'up')` / `'down'`. Update both to pass the selector:

```ts
        upSeriesRef.current.setData(
            buildTrendSplitData(bars, supertrend, 'up', r => r.supertrend)
        );
        downSeriesRef.current.setData(
            buildTrendSplitData(bars, supertrend, 'down', r => r.supertrend)
        );
```

- [ ] **Step 5: Update the supertrend hook test assertions**

In `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`, the two blocks asserting `toHaveBeenCalledWith(FAKE_BARS, ..., 'up')` / `'down'` now receive a 4th argument (the selector function). Update each `toHaveBeenCalledWith(...)` to append `expect.any(Function)`:

```ts
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.supertrend,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.supertrend,
            'down',
            expect.any(Function)
        );
```
Apply the same 4th-arg addition to BOTH occurrences (the 'sets data on both series' test and the 're-sets data ... when bars change' test — there are two `toHaveBeenCalledWith(...,'up'...)` and two `...'down'...`; note the second test uses `newBars` not `FAKE_BARS` as the first arg — keep that, only add `expect.any(Function)`).

- [ ] **Step 6: Run the affected tests + tsc**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-a-rest
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts
```
Expected: tsc clean; both files PASS (seriesDataUtils 7 buildTrendSplitData cases, useSupertrendOverlay 9 cases).

- [ ] **Step 7: Lint**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn lint src/widgets/chart/utils/seriesDataUtils.ts src/widgets/chart/hooks/useSupertrendOverlay.ts src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`
Expected: no errors (no unused imports).

- [ ] **Step 8: Commit**

```bash
git add src/widgets/chart/utils/seriesDataUtils.ts src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts src/widgets/chart/hooks/useSupertrendOverlay.ts src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts
git commit -m "refactor(chart): generalize buildTrendSplitData with value selector + generic trend"
```

---

## Task 2: Add colors

**Files:**
- Modify: `src/shared/lib/chartColors.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Collision guard**

The new colors reuse the project trend palette (`#26a69a` teal / `#ef5350` red), consistent with existing semantic aliases (`supertrendUp`, `trendlineAscending`, `supportLine`, `dmiPlus` all = `#26a69a`). Confirm the new KEY names are unused:
```bash
cd /Users/y0ngha/Project/siglens-group-a-rest
grep -rn "parabolicSarUp\|parabolicSarDown\|chandelierLong\|chandelierShort" src/ || echo "KEYS UNUSED — safe"
```
Expected: `KEYS UNUSED — safe`.

- [ ] **Step 2: Add the colors to `CHART_COLORS`**

In `src/shared/lib/chartColors.ts`, immediately AFTER the `supertrendDown: '#ef5350',` line, add:
```ts
    // Parabolic SAR (trend 색 점) — DESIGN.md 추세 고정값 재사용
    parabolicSarUp: '#26a69a',
    parabolicSarDown: '#ef5350',
    // Chandelier Exit (trend 색 점선 stop) — DESIGN.md 추세 고정값 재사용
    chandelierLong: '#26a69a',
    chandelierShort: '#ef5350',
```

- [ ] **Step 3: Mirror as @theme tokens**

In `src/app/globals.css`, AFTER the `--color-chart-supertrend-down: #ef5350;` line, add:
```css
    /* Chart — Parabolic SAR (추세 색 점) */
    --color-chart-parabolic-sar-up: #26a69a;
    --color-chart-parabolic-sar-down: #ef5350;
    /* Chart — Chandelier Exit (추세 색 점선 stop) */
    --color-chart-chandelier-long: #26a69a;
    --color-chart-chandelier-short: #ef5350;
```

- [ ] **Step 4: Verify lint + format**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn lint src/shared/lib/chartColors.ts && npx prettier --check src/shared/lib/chartColors.ts src/app/globals.css`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/chartColors.ts src/app/globals.css
git commit -m "feat(chart): add parabolicSar + chandelier trend colors"
```

---

## Task 3: Register both indicators

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write the failing registry tests**

In `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`: change the length assertion from `toHaveLength(27)` to `toHaveLength(29)`, and add inside the top-level describe:
```ts
it('registers parabolicSar as a trend overlay', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'parabolicSar');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('trend');
    expect(meta?.kind).toBe('overlay');
    expect(meta?.hasPeriods).toBeUndefined();
});

it('registers chandelierExit as a trend overlay', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'chandelierExit');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('trend');
    expect(meta?.kind).toBe('overlay');
    expect(meta?.hasPeriods).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL (length 27 ≠ 29; metas undefined).

- [ ] **Step 3: Add union members + registry entries**

In `src/widgets/chart/model/indicatorRegistry.ts`:
(a) In `IndicatorKey`, after `| 'supertrend'`, change the terminator so it reads:
```ts
    | 'supertrend'
    | 'parabolicSar'
    | 'chandelierExit';
```
(b) In `INDICATOR_REGISTRY`, after the `supertrend` entry (currently the last element, before the closing `];`), add:
```ts
    {
        key: 'parabolicSar',
        label: 'Parabolic SAR',
        category: 'trend',
        kind: 'overlay',
    },
    {
        key: 'chandelierExit',
        label: 'Chandelier',
        category: 'trend',
        kind: 'overlay',
    },
```

- [ ] **Step 4: Verify registry test passes**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix makePaneIndices fallout**

In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`, inside the `makePaneIndices` base object, after `supertrend: INACTIVE_PANE_INDEX,`, add:
```ts
        parabolicSar: INACTIVE_PANE_INDEX,
        chandelierExit: INACTIVE_PANE_INDEX,
```

- [ ] **Step 6: tsc + both tests**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-a-rest
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```
Expected: tsc clean; both PASS. If tsc flags other `Record<IndicatorKey>` objects missing the new keys, fix each (add `parabolicSar`/`chandelierExit`) and report.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): register parabolicSar + chandelierExit as trend overlays"
```

---

## Task 4: `useParabolicSarOverlay` hook (dots)

**Files:**
- Create: `src/widgets/chart/hooks/useParabolicSarOverlay.ts`
- Test: `src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts` (cloned from useSupertrendOverlay.test.ts, adapted to `parabolicSar` + `r => r.sar`):
```ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useParabolicSarOverlay } from '../../hooks/useParabolicSarOverlay';
import { buildTrendSplitData } from '../../utils/seriesDataUtils';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildTrendSplitData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useParabolicSarOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    parabolicSar: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    parabolicSar: [{ sar: 99, trend: 'up' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useParabolicSarOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(true);
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two LineSeries (up, down) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series with up/down direction and sar selector', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.parabolicSar,
            'up',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.parabolicSar,
            'down',
            expect.any(Function)
        );
    });

    it('does not set data when parabolicSar is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useParabolicSarOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the hook**

Create `src/widgets/chart/hooks/useParabolicSarOverlay.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildTrendSplitData } from '../utils/seriesDataUtils';

interface UseParabolicSarOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseParabolicSarOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useParabolicSarOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseParabolicSarOverlayParams): UseParabolicSarOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const upSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const downSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        upSeriesRef.current = null;
        downSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (upSeriesRef.current) {
            chart.removeSeries(upSeriesRef.current);
            upSeriesRef.current = null;
        }
        if (downSeriesRef.current) {
            chart.removeSeries(downSeriesRef.current);
            downSeriesRef.current = null;
        }
    });

    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당.
    // 가격 위/아래 점(dot)만 렌더하므로 lineVisible:false + pointMarkersVisible:true.
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        if (!upSeriesRef.current) {
            upSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.parabolicSarUp,
                lineVisible: false,
                pointMarkersVisible: true,
                pointMarkersRadius: 2,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }

        if (!downSeriesRef.current) {
            downSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.parabolicSarDown,
                lineVisible: false,
                pointMarkersVisible: true,
                pointMarkersRadius: 2,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { parabolicSar } = indicators;
        if (!parabolicSar.length) return;

        if (!upSeriesRef.current || !downSeriesRef.current) return;

        upSeriesRef.current.setData(
            buildTrendSplitData(bars, parabolicSar, 'up', r => r.sar)
        );
        downSeriesRef.current.setData(
            buildTrendSplitData(bars, parabolicSar, 'down', r => r.sar)
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
```
NOTE: `lineWidth` is kept in the lifecycle effect deps for parity with the sibling overlay hooks even though point markers do not draw a line; this keeps the hook shape identical and avoids an exhaustive-deps lint exception. Do not remove it.

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: tsc + lint**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && npx tsc --noEmit && yarn lint src/widgets/chart/hooks/useParabolicSarOverlay.ts src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts`
Expected: clean. (If `lineWidth` triggers an unused-var lint error because point markers don't use it, reference it harmlessly is NOT needed — it IS passed in deps; confirm clean. If lint flags it as unused, the cleanest fix is to keep `lineWidth` in the param + deps as written; report any lint output.)

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/hooks/useParabolicSarOverlay.ts src/widgets/chart/__tests__/hooks/useParabolicSarOverlay.test.ts
git commit -m "feat(chart): add useParabolicSarOverlay hook (trend-colored dots)"
```

---

## Task 5: `useChandelierOverlay` hook (dashed stop)

**Files:**
- Create: `src/widgets/chart/hooks/useChandelierOverlay.ts`
- Test: `src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts`:
```ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useChandelierOverlay } from '../../hooks/useChandelierOverlay';
import { buildTrendSplitData } from '../../utils/seriesDataUtils';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    LineSeries: 'LineSeries',
    LineStyle: { Dashed: 2 },
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildTrendSplitData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useChandelierOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    chandelierExit: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    chandelierExit: [{ longStop: 90, shortStop: 110, trend: 'long' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useChandelierOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(true);
        act(() => result.current.toggle());
        expect(result.current.isVisible).toBe(false);
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two LineSeries (long, short) when visible and chart exists', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when toggled off', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data with long/short direction and longStop/shortStop selectors', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);
        const splitMock = vi.mocked(buildTrendSplitData);
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.chandelierExit,
            'long',
            expect.any(Function)
        );
        expect(splitMock).toHaveBeenCalledWith(
            FAKE_BARS,
            FILLED_INDICATORS.chandelierExit,
            'short',
            expect.any(Function)
        );
    });

    it('long selector reads longStop, short selector reads shortStop', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        const calls = vi.mocked(buildTrendSplitData).mock.calls;
        const longCall = calls.find(c => c[2] === 'long');
        const shortCall = calls.find(c => c[2] === 'short');
        const row = { longStop: 90, shortStop: 110, trend: 'long' as const };
        expect(longCall?.[3](row)).toBe(90);
        expect(shortCall?.[3](row)).toBe(110);
    });

    it('does not set data when chandelierExit is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('provides stable toggle function reference', () => {
        const { result, rerender } = renderHook(() =>
            useChandelierOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        const firstToggle = result.current.toggle;
        rerender();
        expect(result.current.toggle).toBe(firstToggle);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create the hook**

Create `src/widgets/chart/hooks/useChandelierOverlay.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import {
    useCallback,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildTrendSplitData } from '../utils/seriesDataUtils';

interface UseChandelierOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseChandelierOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useChandelierOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseChandelierOverlayParams): UseChandelierOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const longSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const shortSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    const clearSeriesRefs = useEffectEvent(() => {
        longSeriesRef.current = null;
        shortSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (longSeriesRef.current) {
            chart.removeSeries(longSeriesRef.current);
            longSeriesRef.current = null;
        }
        if (shortSeriesRef.current) {
            chart.removeSeries(shortSeriesRef.current);
            shortSeriesRef.current = null;
        }
    });

    // bars, indicators는 의존하지 않음 — 데이터 세팅은 아래 effect가 단독 담당.
    // supertrend(solid)와 구분되도록 LineStyle.Dashed로 그린다.
    useEffect(() => {
        const chart = chartRef.current;

        if (prevChartRef.current !== chart) {
            clearSeriesRefs();
            prevChartRef.current = chart;
        }

        if (!chart) return;

        if (!isVisible) {
            removeAllSeries(chart);
            return;
        }

        if (!longSeriesRef.current) {
            longSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.chandelierLong,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        longSeriesRef.current.applyOptions({ lineWidth });

        if (!shortSeriesRef.current) {
            shortSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.chandelierShort,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        shortSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { chandelierExit } = indicators;
        if (!chandelierExit.length) return;

        if (!longSeriesRef.current || !shortSeriesRef.current) return;

        longSeriesRef.current.setData(
            buildTrendSplitData(bars, chandelierExit, 'long', r => r.longStop)
        );
        shortSeriesRef.current.setData(
            buildTrendSplitData(bars, chandelierExit, 'short', r => r.shortStop)
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: tsc + lint**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && npx tsc --noEmit && yarn lint src/widgets/chart/hooks/useChandelierOverlay.ts src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/hooks/useChandelierOverlay.ts src/widgets/chart/__tests__/hooks/useChandelierOverlay.test.ts
git commit -m "feat(chart): add useChandelierOverlay hook (dashed trend-colored stop)"
```

---

## Task 6: OverlayLegend configs

**Files:**
- Modify: `src/widgets/chart/utils/overlayLabelUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`: FIRST add `parabolicSarVisible: false,` and `chandelierVisible: false,` to EVERY existing `buildOverlayLabelConfigs({...})` call object in BOTH this file and `overlayLabelUtilsBranches.test.ts` (run tsc in Step 5 to catch any you miss). THEN add these tests inside the top-level describe:
```ts
it('includes a PSAR config (value + trend getColor) when parabolicSarVisible', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [],
        emaVisiblePeriods: [],
        bollingerVisible: false,
        ichimokuVisible: false,
        vpVisible: false,
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: false,
        parabolicSarVisible: true,
        chandelierVisible: false,
    });
    const psar = configs.find(c => c.name === 'PSAR');
    expect(psar).toBeDefined();
    const ind = {
        parabolicSar: [
            { sar: 99, trend: 'up' },
            { sar: 98, trend: 'down' },
        ],
    } as never;
    expect(psar?.getValue(ind, 0)).toBe(99);
    expect(psar?.getValue(ind, 9)).toBeNull();
    expect(psar?.getColor?.(ind, 0)).toBe(CHART_COLORS.parabolicSarUp);
    expect(psar?.getColor?.(ind, 1)).toBe(CHART_COLORS.parabolicSarDown);
    expect(psar?.getColor?.(ind, 9)).toBe(CHART_COLORS.neutral);
});

it('includes a Chandelier config (active stop by trend + trend getColor) when chandelierVisible', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [],
        emaVisiblePeriods: [],
        bollingerVisible: false,
        ichimokuVisible: false,
        vpVisible: false,
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: false,
        parabolicSarVisible: false,
        chandelierVisible: true,
    });
    const ch = configs.find(c => c.name === 'Chandelier');
    expect(ch).toBeDefined();
    const ind = {
        chandelierExit: [
            { longStop: 90, shortStop: 110, trend: 'long' },
            { longStop: 91, shortStop: 111, trend: 'short' },
            { longStop: null, shortStop: null, trend: null },
        ],
    } as never;
    expect(ch?.getValue(ind, 0)).toBe(90); // long → longStop
    expect(ch?.getValue(ind, 1)).toBe(111); // short → shortStop
    expect(ch?.getValue(ind, 2)).toBeNull();
    expect(ch?.getColor?.(ind, 0)).toBe(CHART_COLORS.chandelierLong);
    expect(ch?.getColor?.(ind, 1)).toBe(CHART_COLORS.chandelierShort);
    expect(ch?.getColor?.(ind, 2)).toBe(CHART_COLORS.neutral);
});

it('omits PSAR and Chandelier configs when their flags are false', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [],
        emaVisiblePeriods: [],
        bollingerVisible: false,
        ichimokuVisible: false,
        vpVisible: false,
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: false,
        parabolicSarVisible: false,
        chandelierVisible: false,
    });
    expect(configs.find(c => c.name === 'PSAR')).toBeUndefined();
    expect(configs.find(c => c.name === 'Chandelier')).toBeUndefined();
});
```
Ensure `CHART_COLORS` is imported at the top of the test file (it is already used in the supertrend tests).

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`
Expected: FAIL — unknown params / configs not found.

- [ ] **Step 3: Add params + config blocks**

In `src/widgets/chart/utils/overlayLabelUtils.ts`:
(a) In `BuildOverlayLabelConfigsParams`, after `supertrendVisible: boolean;`, add:
```ts
    parabolicSarVisible: boolean;
    chandelierVisible: boolean;
```
(b) In the destructured params, after `supertrendVisible,`, add `parabolicSarVisible,` and `chandelierVisible,`.
(c) After the `supertrendConfigs` block, add:
```ts
    const parabolicSarConfigs: OverlayLabelConfig[] = parabolicSarVisible
        ? [
              {
                  name: 'PSAR',
                  color: CHART_COLORS.parabolicSarUp,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.parabolicSar[i]?.sar ?? null,
                  getColor: (ind: IndicatorResult, i: number): string => {
                      const trend = ind.parabolicSar[i]?.trend;
                      if (trend === 'down')
                          return CHART_COLORS.parabolicSarDown;
                      if (trend === 'up') return CHART_COLORS.parabolicSarUp;
                      return CHART_COLORS.neutral;
                  },
              },
          ]
        : [];

    const chandelierConfigs: OverlayLabelConfig[] = chandelierVisible
        ? [
              {
                  name: 'Chandelier',
                  color: CHART_COLORS.chandelierLong,
                  // active stop만 표시: long 추세→longStop, short 추세→shortStop.
                  getValue: (ind: IndicatorResult, i: number): number | null => {
                      const r = ind.chandelierExit[i];
                      if (r?.trend === 'long') return r.longStop;
                      if (r?.trend === 'short') return r.shortStop;
                      return null;
                  },
                  getColor: (ind: IndicatorResult, i: number): string => {
                      const trend = ind.chandelierExit[i]?.trend;
                      if (trend === 'short') return CHART_COLORS.chandelierShort;
                      if (trend === 'long') return CHART_COLORS.chandelierLong;
                      return CHART_COLORS.neutral;
                  },
              },
          ]
        : [];
```
(d) In the returned array, after `...supertrendConfigs,`, add `...parabolicSarConfigs,` and `...chandelierConfigs,`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn vitest run src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts src/widgets/chart/__tests__/utils/overlayLabelUtilsBranches.test.ts`
Expected: PASS.

- [ ] **Step 5: tsc (catches StockChart caller missing the 2 new params — EXPECTED, leave StockChart for Task 7)**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && npx tsc --noEmit`
Expected: the ONLY remaining tsc error is in `StockChart.tsx` (its `buildOverlayLabelConfigs` call now misses `parabolicSarVisible`/`chandelierVisible`). Confirm no other errors. Do NOT edit StockChart.tsx here — Task 7 wires it. Fix any test-file callers that tsc flags.

- [ ] **Step 6: Lint**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn lint src/widgets/chart/utils/overlayLabelUtils.ts src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts src/widgets/chart/__tests__/utils/overlayLabelUtilsBranches.test.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/chart/utils/overlayLabelUtils.ts src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts src/widgets/chart/__tests__/utils/overlayLabelUtilsBranches.test.ts
git commit -m "feat(chart): add parabolicSar + chandelier overlay legend configs"
```

---

## Task 7: Wire both into StockChart

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`

- [ ] **Step 1: Add imports + hook calls**

In `src/widgets/chart/StockChart.tsx`, after the `import { useSupertrendOverlay } from './hooks/useSupertrendOverlay';` line (~line 26), add:
```ts
import { useParabolicSarOverlay } from './hooks/useParabolicSarOverlay';
import { useChandelierOverlay } from './hooks/useChandelierOverlay';
```
After the `useSupertrendOverlay(commonHookParams)` destructure (~line 207), add:
```ts
    const { isVisible: parabolicSarVisible, toggle: toggleParabolicSar } =
        useParabolicSarOverlay(commonHookParams);

    const { isVisible: chandelierVisible, toggle: toggleChandelier } =
        useChandelierOverlay(commonHookParams);
```

- [ ] **Step 2: Pass to buildOverlayLabelConfigs**

In the `overlayLabelConfigs` useMemo, add `parabolicSarVisible,` and `chandelierVisible,` to BOTH the call object (after `supertrendVisible,`) AND the dependency array (after `supertrendVisible,`).

- [ ] **Step 3: Add 2 bindings (27→29)**

In the `indicatorBindings` useMemo, after the `supertrend` binding object (the last entry, before the `],` closing the array), add:
```ts
            {
                meta: INDICATOR_META.parabolicSar,
                active: parabolicSarVisible,
                onToggle: toggleParabolicSar,
            },
            {
                meta: INDICATOR_META.chandelierExit,
                active: chandelierVisible,
                onToggle: toggleChandelier,
            },
```
Then add to the useMemo dependency array: `parabolicSarVisible,`, `chandelierVisible,`, `toggleParabolicSar,`, `toggleChandelier,`.

- [ ] **Step 4: tsc + chart suite**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-a-rest
npx tsc --noEmit
yarn vitest run src/widgets/chart
```
Expected: tsc fully clean (StockChart error gone). All chart tests PASS. If `StockChart.test.tsx` asserts a binding count of 27 (or a `data-keys` string), update it to 29 and append `,parabolicSar,chandelierExit` to the expected keys (report it).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/StockChart.tsx src/widgets/chart/__tests__/StockChart.test.tsx
git commit -m "feat(chart): wire parabolicSar + chandelier overlays into StockChart (29 bindings)"
```

---

## Task 8: E2E modal toggles

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: Add two overlay-toggle tests**

In `e2e/specs/chart-indicators.spec.ts`, immediately after the Supertrend test's closing `});` and BEFORE the `});` that closes the `test.describe('chart indicator settings modal', ...)` block, insert:
```ts

    test('toggles the Parabolic SAR overlay via the modal', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        const dialog = page.getByRole('dialog');
        // Parabolic SAR는 가격 OVERLAY(점 마커) — Keltner/Supertrend와 동일하게
        // 모달 체크박스 상태로 검증한다. exact로 substring 충돌 방지.
        const psar = dialog.getByRole('checkbox', {
            name: 'Parabolic SAR',
            exact: true,
        });
        await expect(psar).not.toBeChecked();
        await psar.check();
        await expect(psar).toBeChecked();
    });

    test('toggles the Chandelier overlay via the modal', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        const dialog = page.getByRole('dialog');
        const chandelier = dialog.getByRole('checkbox', {
            name: 'Chandelier',
            exact: true,
        });
        await expect(chandelier).not.toBeChecked();
        await chandelier.check();
        await expect(chandelier).toBeChecked();
    });
```
`GEAR` is the const already at the top of the describe — reuse it.

- [ ] **Step 2: Lint + tsc**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn lint e2e/specs/chart-indicators.spec.ts && npx tsc --noEmit`
Expected: clean. (Do NOT run the full Playwright suite locally — it uses the shared docker-compose backend; CI's `e2e` job is the gate.)

- [ ] **Step 3: Commit**

```bash
git add e2e/specs/chart-indicators.spec.ts
git commit -m "test(e2e): toggle Parabolic SAR + Chandelier overlays from settings modal"
```

---

## Task 9: Final verification + review handoff

**Files:** none (verification only)

- [ ] **Step 1: Full coverage suite (CI-equivalent gate)**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn test-coverage > /tmp/group-a-rest-cov.log 2>&1; echo "EXIT=$?"; tail -8 /tmp/group-a-rest-cov.log`
Expected: `EXIT=0`, all global thresholds (90%+) met.

- [ ] **Step 2: Lint + format (whole repo)**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn lint && npx prettier --check .`
Expected: no errors. (Use `npx prettier --check .`, not `yarn format --cache`.)

- [ ] **Step 3: Production build (capture exit code directly, no pipe)**

Run: `cd /Users/y0ngha/Project/siglens-group-a-rest && yarn build > /tmp/group-a-rest-build.log 2>&1; echo "EXIT=$?"; tail -12 /tmp/group-a-rest-build.log`
Expected: `EXIT=0`.

- [ ] **Step 4: Hand off to review**

Implementation complete. Per CLAUDE.md routing: invoke `review-agent` (Opus 4.8) on branch `feat/render-group-a-rest`, then `mistake-managing-agent`, then `git-agent` to push and open the PR stacked on `feat/render-supertrend` (#582). Do not merge before APPROVED.

---

## Self-Review

**Spec coverage:**
- §3.1 generalize `buildTrendSplitData` (+ supertrend call/test update) → Task 1. ✓
- §3.2 `useParabolicSarOverlay` (dots) → Task 4. ✓
- §3.3 `useChandelierOverlay` (dashed, long/short) → Task 5. ✓
- §3.4 registry +2 (27→29, makePaneIndices, StockChart.test count) → Task 3 + Task 7 Step 4. ✓
- §3.5 colors + @theme → Task 2. ✓
- §3.6 overlayLabelUtils +2 configs with getColor → Task 6. ✓
- §3.7 StockChart wiring → Task 7. ✓
- §5.2 E2E ×2 → Task 8. ✓
- §5 test strategy (90%+, happy + worst) → Tasks 1/4/5/6 cover null trend, null value, length mismatch, empty inputs, off-range index, long/short selectors, bars-change re-sync. ✓

**Placeholder scan:** No TBD/TODO. Every code step has complete code.

**Type consistency:** `buildTrendSplitData<Dir, T>(bars, data, dir, getValue)` signature identical across Tasks 1/4/5/6. `parabolicSarVisible`/`chandelierVisible` booleans threaded identically through Tasks 6/7. Color keys `parabolicSarUp/Down`, `chandelierLong/Short` consistent across Tasks 2/4/5/6. Registry count 27→29 consistent across Tasks 3/7. `PSAR`/`Chandelier` legend names consistent between Task 6 config and tests. ✓
