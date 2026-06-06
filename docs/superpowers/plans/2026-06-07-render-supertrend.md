# Supertrend (trend-colored overlay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the `supertrend` indicator as a price-pane overlay whose line color flips between green (uptrend) and red (downtrend) by trend direction.

**Architecture:** Reuse the established overlay-hook mechanism (`useKeltnerOverlay`/`useBollingerOverlay`). Because lightweight-charts `LineSeries` has no per-point color, trend coloring is achieved with **two `LineSeries`** (up = green, down = red); each receives the supertrend value only on bars matching its direction, whitespace otherwise. A new pure helper `buildTrendSplitData` produces that split. The registry gains one `kind: 'overlay'` entry so the settings modal exposes it automatically. Computation lives in `@y0ngha/siglens-core` (unchanged); this is pure siglens rendering.

**Tech Stack:** TypeScript, React 19 (`useEffectEvent`), lightweight-charts 5.1.0, Vitest + React Testing Library, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-render-supertrend-design.md`
**Branch:** `feat/render-supertrend` (base: `feat/render-group-a-bands` = PR #581)
**Worktree:** `/Users/y0ngha/Project/siglens-supertrend`

**Data shape (from siglens-core `domain/types.d.ts`):**
```ts
interface SupertrendResult { supertrend: number | null; trend: TrendDirection; }
// TrendDirection = 'up' | 'down' | null
// IndicatorResult.supertrend: SupertrendResult[]
```

---

## File Structure

- `src/shared/lib/chartColors.ts` — add `supertrendUp` / `supertrendDown` to `CHART_COLORS` (modify).
- `src/app/globals.css` — mirror the two colors as `@theme` tokens (modify; matches #581 precedent).
- `src/widgets/chart/utils/seriesDataUtils.ts` — add `buildTrendSplitData` helper (modify).
- `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts` — add helper tests (modify; create if absent).
- `src/widgets/chart/model/indicatorRegistry.ts` — `IndicatorKey` + `INDICATOR_REGISTRY` gain `supertrend` (modify).
- `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` — registry-count + supertrend assertions (modify).
- `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts` — `makePaneIndices` gains `supertrend: INACTIVE_PANE_INDEX` (modify).
- `src/widgets/chart/hooks/useSupertrendOverlay.ts` — new overlay hook, two LineSeries (create).
- `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts` — hook tests (create).
- `src/widgets/chart/utils/overlayLabelUtils.ts` — `supertrendVisible` param + config block (modify).
- `src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts` — supertrend config assertions (modify).
- `src/widgets/chart/StockChart.tsx` — call hook, wire `overlayLabelConfigs` + 27th binding (modify).
- `e2e/specs/chart-indicators.spec.ts` — modal-checkbox toggle for Supertrend (modify).

---

## Task 0: Worktree node_modules setup

**Files:** none (environment only)

- [ ] **Step 1: Verify worktree node_modules exists and is usable**

The worktree must have its own real `node_modules` (hardlink copy, NOT symlink — Turbopack rejects symlinks and a symlinked tree causes dual-React `useEffect` null failures).

Run:
```bash
cd /Users/y0ngha/Project/siglens-supertrend
[ -e node_modules/.bin/vitest ] && [ ! -L node_modules ] && echo "OK: real node_modules present" || echo "MISSING"
```
Expected: `OK: real node_modules present`

- [ ] **Step 2: If MISSING, create a hardlink copy from the main checkout**

Run:
```bash
cd /Users/y0ngha/Project/siglens-supertrend
cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules
rm -rf node_modules/node_modules
```
Expected: completes silently. Re-run Step 1 to confirm `OK`.

- [ ] **Step 3: Sanity-check the toolchain**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/hooks/useKeltnerOverlay.test.ts`
Expected: PASS (confirms vitest + jsdom + lightweight-charts mock resolve in the worktree).

---

## Task 1: Add supertrend colors

**Files:**
- Modify: `src/shared/lib/chartColors.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Verify the candidate hex values are unused (collision guard)**

Standard supertrend uses a saturated green (up) and red (down). Candidates: `#16a34a` (green-600), `#dc2626` (red-600).

Run:
```bash
cd /Users/y0ngha/Project/siglens-supertrend
grep -rn "16a34a\|dc2626" src/ || echo "BOTH UNUSED — safe"
```
Expected: `BOTH UNUSED — safe`. If either collides, pick another saturated green/red not already in `CHART_COLORS` (e.g. `#15803d` / `#b91c1c`) and use it consistently below.

- [ ] **Step 2: Add the two colors to `CHART_COLORS`**

In `src/shared/lib/chartColors.ts`, immediately after the `ewmaVolatilityLine: '#6ee7b7',` line (last entry before the closing `} as const;`), add:
```ts
    // Supertrend (trend 색 라인 — up=초록, down=빨강)
    supertrendUp: '#16a34a',
    supertrendDown: '#dc2626',
```

- [ ] **Step 3: Mirror the colors as `@theme` tokens**

In `src/app/globals.css`, after the `--color-chart-donchian-middle: #d97706;` block, add:
```css
    /* Chart — Supertrend */
    --color-chart-supertrend-up: #16a34a;
    --color-chart-supertrend-down: #dc2626;
```
(This matches the #581 precedent where overlay legend colors are mirrored in `@theme`.)

- [ ] **Step 4: Verify lint + format pass for the changed files**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn lint && npx prettier --check src/shared/lib/chartColors.ts src/app/globals.css`
Expected: no errors.

- [ ] **Step 5: Commit** (delegate to git-agent per CLAUDE.md — controller dispatches)

```bash
git add src/shared/lib/chartColors.ts src/app/globals.css
git commit -m "feat(chart): add supertrend up/down colors"
```

---

## Task 2: `buildTrendSplitData` helper

**Files:**
- Modify: `src/widgets/chart/utils/seriesDataUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts` (create the file with the standard import header if it does not exist):
```ts
import { describe, it, expect } from 'vitest';
import type { Bar, SupertrendResult } from '@y0ngha/siglens-core';
import { buildTrendSplitData } from '../../utils/seriesDataUtils';

function bar(time: number): Bar {
    return { time, open: 1, high: 2, low: 0, close: 1, volume: 10 };
}

describe('buildTrendSplitData', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];
    const data: SupertrendResult[] = [
        { supertrend: 10, trend: 'up' },
        { supertrend: 11, trend: 'down' },
        { supertrend: null, trend: null },
    ];

    it("returns value only on bars whose trend matches 'up', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'up')).toEqual([
            { time: 1, value: 10 },
            { time: 2 },
            { time: 3 },
        ]);
    });

    it("returns value only on bars whose trend matches 'down', whitespace otherwise", () => {
        expect(buildTrendSplitData(bars, data, 'down')).toEqual([
            { time: 1 },
            { time: 2, value: 11 },
            { time: 3 },
        ]);
    });

    it('up and down outputs are complementary on matched bars (never both have value)', () => {
        const up = buildTrendSplitData(bars, data, 'up');
        const down = buildTrendSplitData(bars, data, 'down');
        up.forEach((u, i) => {
            const bothHaveValue = 'value' in u && 'value' in down[i];
            expect(bothHaveValue).toBe(false);
        });
    });

    it('emits whitespace when supertrend is null even if trend matches dir', () => {
        const nullVal: SupertrendResult[] = [{ supertrend: null, trend: 'up' }];
        expect(buildTrendSplitData([bar(1)], nullVal, 'up')).toEqual([
            { time: 1 },
        ]);
    });

    it('clamps to the shorter of bars / data length (worst case)', () => {
        const longBars = [bar(1), bar(2), bar(3), bar(4)];
        const shortData: SupertrendResult[] = [{ supertrend: 5, trend: 'up' }];
        const out = buildTrendSplitData(longBars, shortData, 'up');
        expect(out).toEqual([{ time: 1, value: 5 }]);
    });

    it('returns empty array for empty inputs', () => {
        expect(buildTrendSplitData([], [], 'up')).toEqual([]);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`
Expected: FAIL with "buildTrendSplitData is not a function" / import error.

- [ ] **Step 3: Implement the helper**

In `src/widgets/chart/utils/seriesDataUtils.ts`, add the `SupertrendResult` import to the existing core import line:
```ts
import type { Bar, SupertrendResult } from '@y0ngha/siglens-core';
```
Then append at the end of the file:
```ts
/**
 * trend 방향이 dir과 일치하는 bar만 supertrend 값을, 나머지는 WhitespaceData({ time })를 반환한다.
 * up/down 2개 LineSeries로 trend별 색을 표현하기 위함 (LineSeries는 per-point 색 미지원).
 */
export function buildTrendSplitData(
    bars: Bar[],
    data: SupertrendResult[],
    dir: 'up' | 'down'
): SeriesPoint[] {
    const count = Math.min(bars.length, data.length);
    return bars.slice(0, count).map((bar, i) => {
        const r = data[i];
        if (r && r.trend === dir && r.supertrend !== null) {
            return { time: bar.time as UTCTimestamp, value: r.supertrend };
        }
        return { time: bar.time as UTCTimestamp };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 5: Type-check**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && npx tsc --noEmit`
Expected: no errors. (vitest only transpiles — `tsc` is the real type gate.)

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/utils/seriesDataUtils.ts src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts
git commit -m "feat(chart): add buildTrendSplitData helper for trend-colored series"
```

---

## Task 3: Register supertrend in the indicator registry

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write the failing registry test**

In `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`, update the count assertion (currently 26) to 27 and add a supertrend-specific assertion. Add this test inside the existing top-level `describe`:
```ts
it('registers supertrend as a trend overlay', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'supertrend');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('trend');
    expect(meta?.kind).toBe('overlay');
    expect(meta?.hasPeriods).toBeUndefined();
});
```
If there is an existing assertion like `expect(INDICATOR_REGISTRY).toHaveLength(26)`, change `26` to `27`. If there is a "no duplicate keys" test, it will still pass — leave it.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL (length 26 ≠ 27 and/or supertrend meta undefined).

- [ ] **Step 3: Add the registry entry and union member**

In `src/widgets/chart/model/indicatorRegistry.ts`:

(a) Add `| 'supertrend'` to the `IndicatorKey` union, after `| 'donchianChannel'`:
```ts
    | 'donchianChannel'
    | 'supertrend';
```

(b) Add the meta to `INDICATOR_REGISTRY`, after the `donchianChannel` entry (the last array element, before the closing `];`):
```ts
    {
        key: 'supertrend',
        label: 'Supertrend',
        category: 'trend',
        kind: 'overlay',
    },
```

- [ ] **Step 4: Run registry test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the `makePaneIndices` fallout (type-completeness)**

Adding a key to `IndicatorKey` widens `PaneIndices` (a `Record<IndicatorKey, number>`), so the `satisfies PaneIndices` object in `paneLabelUtils.test.ts` now misses a key. In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`, add to the `makePaneIndices` base object, after `donchianChannel: INACTIVE_PANE_INDEX,`:
```ts
        supertrend: INACTIVE_PANE_INDEX,
```
(supertrend is an overlay → never gets a pane index → always INACTIVE.)

- [ ] **Step 6: Type-check + run both affected test files**

Run:
```bash
cd /Users/y0ngha/Project/siglens-supertrend
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```
Expected: tsc clean; both test files PASS.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): register supertrend as trend overlay"
```

---

## Task 4: `useSupertrendOverlay` hook

**Files:**
- Create: `src/widgets/chart/hooks/useSupertrendOverlay.ts`
- Test: `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts` (cloned from `useKeltnerOverlay.test.ts`, adapted to 2 series + supertrend data + `buildTrendSplitData` mock):
```ts
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useSupertrendOverlay } from '../../hooks/useSupertrendOverlay';

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
        typeof useSupertrendOverlay
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = {
    supertrend: [],
} as unknown as IndicatorResult;

const FILLED_INDICATORS = {
    supertrend: [{ supertrend: 10, trend: 'up' }],
} as unknown as IndicatorResult;

const FAKE_BARS: Bar[] = [
    { time: 1000, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
];

describe('useSupertrendOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns isVisible false initially', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(),
                bars: [],
                indicators: EMPTY_INDICATORS,
            })
        );
        expect(result.current.isVisible).toBe(false);
    });

    it('toggles isVisible when toggle is called', () => {
        const { result } = renderHook(() =>
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        act(() => result.current.toggle());
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
            })
        );
        act(() => result.current.toggle());
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('does not set data when supertrend is empty', () => {
        const chart = makeChart();
        const { result } = renderHook(() =>
            useSupertrendOverlay({
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
            useSupertrendOverlay({
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`
Expected: FAIL ("useSupertrendOverlay is not a function" / module not found).

- [ ] **Step 3: Implement the hook**

Create `src/widgets/chart/hooks/useSupertrendOverlay.ts`:
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

interface UseSupertrendOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseSupertrendOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useSupertrendOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseSupertrendOverlayParams): UseSupertrendOverlayReturn {
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
    // StockChart의 차트 생성 effect가 선언 순서상 앞에 있으므로
    // 이 effect 실행 시점에 chartRef.current는 이미 설정된 상태.
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
                color: CHART_COLORS.supertrendUp,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        upSeriesRef.current.applyOptions({ lineWidth });

        if (!downSeriesRef.current) {
            downSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.supertrendDown,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        downSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    // isVisible이 true로 바뀔 때도 실행되어 새로 생성된 시리즈에 초기 데이터를 세팅함
    useEffect(() => {
        if (!isVisible) return;

        const { supertrend } = indicators;
        if (!supertrend.length) return;

        if (!upSeriesRef.current || !downSeriesRef.current) return;

        upSeriesRef.current.setData(buildTrendSplitData(bars, supertrend, 'up'));
        downSeriesRef.current.setData(
            buildTrendSplitData(bars, supertrend, 'down')
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Type-check**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/hooks/useSupertrendOverlay.ts src/widgets/chart/__tests__/hooks/useSupertrendOverlay.test.ts
git commit -m "feat(chart): add useSupertrendOverlay hook (up/down 2 LineSeries)"
```

---

## Task 5: OverlayLegend config for supertrend

**Files:**
- Modify: `src/widgets/chart/utils/overlayLabelUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`, add (and update any existing calls to `buildOverlayLabelConfigs` so they keep compiling — see Step 3 note):
```ts
it('includes a Supertrend config when supertrendVisible is true', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [],
        emaVisiblePeriods: [],
        bollingerVisible: false,
        ichimokuVisible: false,
        vpVisible: false,
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: true,
    });
    const st = configs.find(c => c.name === 'Supertrend');
    expect(st).toBeDefined();
    expect(st?.color).toBe(CHART_COLORS.supertrendUp);
    const ind = { supertrend: [{ supertrend: 42, trend: 'up' }] } as never;
    expect(st?.getValue(ind, 0)).toBe(42);
    expect(st?.getValue(ind, 5)).toBeNull();
});

it('omits Supertrend config when supertrendVisible is false', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [],
        emaVisiblePeriods: [],
        bollingerVisible: false,
        ichimokuVisible: false,
        vpVisible: false,
        keltnerVisible: false,
        donchianVisible: false,
        supertrendVisible: false,
    });
    expect(configs.find(c => c.name === 'Supertrend')).toBeUndefined();
});
```
Ensure `CHART_COLORS` is imported at the top of the test file (it is used here): `import { CHART_COLORS } from '@/shared/lib/chartColors';` — add only if not already present.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`
Expected: FAIL — TS/runtime error on the unknown `supertrendVisible` property, or `Supertrend` config not found.

- [ ] **Step 3: Add the param and config block**

In `src/widgets/chart/utils/overlayLabelUtils.ts`:

(a) Add `supertrendVisible: boolean;` to the `BuildOverlayLabelConfigsParams` interface (after `donchianVisible: boolean;`).

(b) Add `supertrendVisible,` to the destructured params of `buildOverlayLabelConfigs` (after `donchianVisible,`).

(c) After the `donchianConfigs` block, add:
```ts
    const supertrendConfigs: OverlayLabelConfig[] = supertrendVisible
        ? [
              {
                  name: 'Supertrend',
                  color: CHART_COLORS.supertrendUp,
                  getValue: (ind: IndicatorResult, i: number): number | null =>
                      ind.supertrend[i]?.supertrend ?? null,
              },
          ]
        : [];
```

(d) Add `...supertrendConfigs,` to the returned array (after `...donchianConfigs,`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`
Expected: PASS. (If pre-existing tests in this file call `buildOverlayLabelConfigs` without `supertrendVisible`, add `supertrendVisible: false` to each — tsc will flag them in Step 5.)

- [ ] **Step 5: Type-check**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && npx tsc --noEmit`
Expected: no errors. Fix any callers in the test file that now miss `supertrendVisible`.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/utils/overlayLabelUtils.ts src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts
git commit -m "feat(chart): add supertrend overlay legend config"
```

---

## Task 6: Wire supertrend into StockChart

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`

- [ ] **Step 1: Call the hook**

In `src/widgets/chart/StockChart.tsx`, add the import near the other overlay-hook imports (after the `useDonchianOverlay` import, line ~25):
```ts
import { useSupertrendOverlay } from './hooks/useSupertrendOverlay';
```
Then add the hook call immediately after the `useDonchianOverlay` call (line ~203):
```ts
    const { isVisible: supertrendVisible, toggle: toggleSupertrend } =
        useSupertrendOverlay(commonHookParams);
```

- [ ] **Step 2: Pass `supertrendVisible` to `buildOverlayLabelConfigs`**

In the `overlayLabelConfigs` `useMemo` (line ~368), add `supertrendVisible,` to both the call object (after `donchianVisible,`) and the dependency array (after `donchianVisible,`).

- [ ] **Step 3: Add the 27th binding**

In the `indicatorBindings` `useMemo` (line ~408), add after the `donchianChannel` binding object (the last entry, before the `],` that closes the array):
```ts
            {
                meta: INDICATOR_META.supertrend,
                active: supertrendVisible,
                onToggle: toggleSupertrend,
            },
```
Then add `supertrendVisible,` and `toggleSupertrend,` to the `useMemo` dependency array (after `donchianVisible,` and `toggleDonchian,` respectively).

- [ ] **Step 4: Type-check + run the StockChart-adjacent suites**

Run:
```bash
cd /Users/y0ngha/Project/siglens-supertrend
npx tsc --noEmit
yarn vitest run src/widgets/chart
```
Expected: tsc clean; all chart widget tests PASS. (If a StockChart render test snapshots the binding count, update it to 27.)

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/StockChart.tsx
git commit -m "feat(chart): wire supertrend overlay into StockChart (27th binding)"
```

---

## Task 7: E2E — toggle Supertrend from the settings modal

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: Read the existing keltner/donchian overlay E2E case**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && grep -n "Keltner\|Donchian\|checkbox\|getByRole" e2e/specs/chart-indicators.spec.ts | head -30`
Expected: shows the modal-open + checkbox-toggle pattern for an overlay (overlays are verified by checkbox checked-state, not by a pane label).

- [ ] **Step 2: Add a Supertrend toggle test mirroring the keltner overlay case**

Add a test that: opens the settings modal (gear button), checks the `Supertrend` checkbox, and asserts it becomes checked. Use an exact-name matcher to avoid strict-mode collisions:
```ts
test('toggles Supertrend overlay from the settings modal', async ({ page }) => {
    // (reuse the spec's existing modal-open helper / gear-button locator)
    await openIndicatorModal(page); // or the inline gear-button click used by sibling tests
    const supertrend = page.getByRole('checkbox', {
        name: 'Supertrend',
        exact: true,
    });
    await expect(supertrend).not.toBeChecked();
    await supertrend.check();
    await expect(supertrend).toBeChecked();
});
```
Match the surrounding tests' exact structure (helper names, fixtures, `test.describe` block). Do not invent a helper that doesn't exist — copy the keltner/donchian test body and swap the name to `'Supertrend'`.

- [ ] **Step 3: Note on local E2E**

Full Playwright E2E uses the shared docker-compose backend and is NOT run inside worktrees (per project convention) — it runs in CI on the PR. Do a static/lint check only here:
Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn lint e2e/specs/chart-indicators.spec.ts`
Expected: no lint errors. CI's `e2e` job is the real gate.

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/chart-indicators.spec.ts
git commit -m "test(e2e): toggle Supertrend overlay from settings modal"
```

---

## Task 8: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite + coverage for changed areas**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn vitest run src/widgets/chart src/shared/lib --coverage`
Expected: all PASS; the new helper/hook/config at 90%+ line+branch coverage (happy + worst cases are covered by Tasks 2/4/5).

- [ ] **Step 2: Lint + format (whole repo, matches CI gate)**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn lint && npx prettier --check .`
Expected: no errors. (Use `npx prettier --check .`, not `yarn format --cache`, to avoid stale-cache false negatives — see memory.)

- [ ] **Step 3: Production build (capture exit code directly, no pipe)**

Run: `cd /Users/y0ngha/Project/siglens-supertrend && yarn build > /tmp/supertrend-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`. (Piping to `tail` masks failures as exit 0 — capture directly. If exit ≠ 0, read the log.)

- [ ] **Step 4: Hand off to review**

Implementation complete. Per CLAUDE.md routing: invoke `review-agent` (Opus 4.8) on branch `feat/render-supertrend`, then `mistake-managing-agent`, then `git-agent` to push and open the PR stacked on `feat/render-group-a-bands` (#581). Do not merge before APPROVED.

---

## Self-Review

**Spec coverage:**
- §4.1 `buildTrendSplitData` → Task 2. ✓
- §4.2 `useSupertrendOverlay` (2 LineSeries, trend split, bollinger skeleton) → Task 4. ✓
- §4.3 registry (+IndicatorKey, +entry, makePaneIndices fallout) → Task 3. ✓
- §4.4 colors `supertrendUp`/`supertrendDown` + grep collision → Task 1. ✓
- §4.5 overlayLabelUtils `supertrendVisible` + config → Task 5. ✓
- §4.6 StockChart (hook call, label configs, binding 26→27) → Task 6. ✓
- §6.2 E2E modal toggle → Task 7. ✓
- §6 test strategy (90%+, happy + worst) → Tasks 2/4/5 cover null trend, null supertrend, length mismatch, empty inputs, off-range index. ✓

**Placeholder scan:** No TBD/TODO. The only deliberately non-literal spot is Task 7's modal-open helper, which must mirror the existing keltner/donchian E2E test (named explicitly so the implementer copies the real one rather than inventing).

**Type consistency:** `buildTrendSplitData(bars, data, dir)` signature identical across Tasks 2/4; `SeriesPoint`/`UTCTimestamp` reused from `seriesDataUtils`; `supertrendVisible` boolean threaded identically through Tasks 5/6; `CHART_COLORS.supertrendUp`/`supertrendDown` names consistent across Tasks 1/4/5. Registry count 26→27 consistent across Tasks 3/6. ✓
