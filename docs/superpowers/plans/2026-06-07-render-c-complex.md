# C-Complex Panes (Elder Ray + Squeeze Momentum + Regression) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `elderRay`, `squeezeMomentum`, and `regression` as separate-pane indicators with histograms, zero-line state dots, and r²-modulated opacity.

**Architecture:** Reuse the established pane-hook pattern (`useMACDChart`): each hook takes a `paneIndex` from `useIndicatorVisibility`, manages series lifecycle + data-sync in two effects, and recreates series on paneIndex change. Histograms color per-bar via a row-aware `buildSeriesData` colorFn. Squeeze state dots use a new `buildZeroLineDots` builder. Color decisions live in pure functions. Computation is in `@y0ngha/siglens-core` (unchanged); this is pure siglens rendering.

**Tech Stack:** TypeScript, React 19 (`useEffectEvent`), lightweight-charts 5.2.0 (`HistogramSeries`, `pointMarkersVisible`), Vitest + RTL, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-render-c-complex-design.md`
**Branch:** `feat/render-c-complex` (base: `feat/render-group-a-rest` = PR #584)
**Worktree:** `/Users/y0ngha/Project/siglens-c-complex`

**Data shapes (siglens-core `domain/types.d.ts`):**
```ts
interface ElderRayResult { bullPower: number | null; bearPower: number | null; }
interface SqueezeMomentumResult { momentum: number | null; sqzOn: boolean | null; sqzOff: boolean | null; noSqz: boolean | null; increasing: boolean | null; }
interface RegressionResult { slope: number | null; r2: number | null; }
// IndicatorResult.elderRay / squeezeMomentum / regression: each []
```

**Reference files (read before implementing):**
- `src/widgets/chart/hooks/useMACDChart.ts` — histogram pane hook skeleton (paneIndex lifecycle + data-sync + per-bar colorFn)
- `src/widgets/chart/__tests__/hooks/useAtrChart.test.ts` — pane hook test template
- `src/widgets/chart/utils/paneLabelUtils.ts` — `buildSinglePaneLabel` + MACD-style inline multi-sublabel
- `e2e/specs/chart-indicators.spec.ts` — existing MFI/ATR "toggles into a pane" tests (`.pane-indicator-label`)

---

## File Structure

- `src/widgets/chart/utils/seriesDataUtils.ts` (+ test) — row-aware `buildSeriesData` colorFn + new `buildZeroLineDots` (modify).
- `src/widgets/chart/utils/histogramColorUtils.ts` (+ test) — `squeezeMomentumColor` / `squeezeStateColor` / `regressionBarColor` pure fns (create).
- `src/shared/lib/chartColors.ts` + `src/app/globals.css` — new colors + @theme tokens (modify).
- `src/widgets/chart/model/indicatorRegistry.ts` (+ tests, + paneLabelUtils test) — `IndicatorKey` +3, registry +3 (modify).
- `src/widgets/chart/hooks/useElderRayChart.ts` (+ test) — 2 histograms (create).
- `src/widgets/chart/hooks/useSqueezeMomentumChart.ts` (+ test) — histogram + state dots (create).
- `src/widgets/chart/hooks/useRegressionChart.ts` (+ test) — slope histogram + r² opacity (create).
- `src/widgets/chart/utils/paneLabelUtils.ts` (+ test) — 3 pane labels (modify).
- `src/widgets/chart/StockChart.tsx` (+ test) — 3 hooks, 3 bindings (32) (modify).
- `e2e/specs/chart-indicators.spec.ts` — 3 pane-toggle tests (modify).

---

## Task 0: Worktree node_modules verify

**Files:** none

- [ ] **Step 1: Verify real node_modules**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
[ -e node_modules/.bin/vitest ] && [ ! -L node_modules ] && echo "OK" || echo "MISSING"
```
Expected: `OK`. If MISSING: `cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules && rm -rf node_modules/node_modules`.

- [ ] **Step 2: Sanity-check**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/hooks/useMACDChart.test.ts`
Expected: PASS.

---

## Task 1: Row-aware `buildSeriesData` colorFn + `buildZeroLineDots`

**Files:**
- Modify: `src/widgets/chart/utils/seriesDataUtils.ts`
- Modify: `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts` a new describe + extend the import to include `buildZeroLineDots`:
```ts
describe('buildSeriesData colorFn row arg', () => {
    const bars: Bar[] = [bar(1), bar(2)];
    const data = [
        { v: 5, flag: true },
        { v: -3, flag: false },
    ];

    it('passes (value, row, index) to colorFn', () => {
        const seen: Array<[number, unknown, number]> = [];
        buildSeriesData(bars, data, 'v', (value, row, index) => {
            seen.push([value, row, index]);
            return '#fff';
        });
        expect(seen[0]).toEqual([5, { v: 5, flag: true }, 0]);
        expect(seen[1]).toEqual([-3, { v: -3, flag: false }, 1]);
    });

    it('still supports a value-only colorFn (backward compatible)', () => {
        const out = buildSeriesData(bars, data, 'v', value =>
            value >= 0 ? '#0f0' : '#f00'
        );
        expect(out).toEqual([
            { time: 1, value: 5, color: '#0f0' },
            { time: 2, value: -3, color: '#f00' },
        ]);
    });
});

describe('buildZeroLineDots', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];

    it('emits a zero-value point with the colorFn color per row', () => {
        const data = [{ s: 'a' }, { s: 'b' }, { s: 'c' }];
        const out = buildZeroLineDots(bars, data, row =>
            row.s === 'b' ? '#abc' : null
        );
        expect(out).toEqual([{ time: 1 }, { time: 2, value: 0, color: '#abc' }, { time: 3 }]);
    });

    it('emits whitespace when the row is null/undefined', () => {
        const data = [null, { s: 'x' }] as unknown as Array<{ s: string }>;
        const out = buildZeroLineDots(bars.slice(0, 2), data, () => '#fff');
        expect(out).toEqual([{ time: 1 }, { time: 2, value: 0, color: '#fff' }]);
    });

    it('clamps to the shorter length and returns [] for empty inputs', () => {
        expect(buildZeroLineDots([], [], () => '#fff')).toEqual([]);
        expect(
            buildZeroLineDots(bars, [{ s: 'a' }], () => '#fff')
        ).toEqual([{ time: 1, value: 0, color: '#fff' }]);
    });
});
```
Update the existing top import to add `buildZeroLineDots`:
```ts
import {
    buildSeriesData,
    buildSeriesDataFromValues,
    buildTrendSplitData,
    buildZeroLineDots,
} from '@/widgets/chart/utils/seriesDataUtils';
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts`
Expected: FAIL (colorFn arity / `buildZeroLineDots` not exported).

- [ ] **Step 3: Widen the colorFn type**

In `src/widgets/chart/utils/seriesDataUtils.ts`, change the `buildSeriesData` colorFn param type and the call site:
```ts
    colorFn?: (value: number, row: T, index: number) => string
```
and inside the colored branch:
```ts
        if (colorFn !== undefined) {
            point.color = colorFn(value, indicatorData[i] as T, i);
        }
```

- [ ] **Step 4: Add `buildZeroLineDots`**

Append to `src/widgets/chart/utils/seriesDataUtils.ts`:
```ts
/**
 * 각 bar에 0(zero)라인 위 점({ time, value: 0, color })을 만든다. colorFn이 null을
 * 반환하거나 행이 없으면 해당 bar는 whitespace(점 없음). Squeeze 상태 점처럼 값과
 * 무관하게 0라인에 상태 색을 찍는 용도.
 */
export function buildZeroLineDots<T>(
    bars: Bar[],
    data: T[],
    colorFn: (row: T) => string | null
): SeriesPoint[] {
    const count = Math.min(bars.length, data.length);
    return bars.slice(0, count).map((bar, i) => {
        const row = data[i];
        const color = row == null ? null : colorFn(row);
        if (color === null) {
            return { time: bar.time as UTCTimestamp };
        }
        return { time: bar.time as UTCTimestamp, value: 0, color };
    });
}
```

- [ ] **Step 5: Run tests + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts
yarn lint src/widgets/chart/utils/seriesDataUtils.ts src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts
```
Expected: tsc clean (MACD's existing `value => ...` colorFn still type-checks); tests PASS; lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/chart/utils/seriesDataUtils.ts src/widgets/chart/__tests__/utils/seriesDataUtils.test.ts
git commit -m "feat(chart): row-aware buildSeriesData colorFn + buildZeroLineDots"
```

---

## Task 2: Add colors

**Files:**
- Modify: `src/shared/lib/chartColors.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Collision guard**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
grep -rn "elderBullPower\|elderBearPower\|squeezeMomentumUp\|squeezeMomentumDown\|squeezeOn\|squeezeOff\|squeezeNone\|regressionUp\|regressionDown" src/ || echo "KEYS UNUSED — safe"
```
Expected: `KEYS UNUSED — safe`.

- [ ] **Step 2: Add to `CHART_COLORS`**

In `src/shared/lib/chartColors.ts`, after the `chandelierShort: '#ef5350',` line, add:
```ts
    // Elder Ray (bull/bear power 히스토그램)
    elderBullPower: '#26a69a',
    elderBearPower: '#ef5350',
    // Squeeze Momentum 히스토그램 (강=solid, 약=50% alpha) — DESIGN.md teal/red 기반
    squeezeMomentumUp: '#26a69a',
    squeezeMomentumUpWeak: '#26a69a80',
    squeezeMomentumDown: '#ef5350',
    squeezeMomentumDownWeak: '#ef535080',
    // Squeeze 상태 점 (추세 무관 상태 팔레트)
    squeezeOn: '#fbbf24',
    squeezeOff: '#94a3b8',
    squeezeNone: '#3b82f6',
    // Regression (alpha는 r2로 런타임 계산)
    regressionUp: '#26a69a',
    regressionDown: '#ef5350',
```

- [ ] **Step 3: Mirror solid tokens in `@theme`**

In `src/app/globals.css`, after the `--color-chart-chandelier-short: #ef5350;` line, add:
```css
    /* Chart — Elder Ray */
    --color-chart-elder-bull-power: #26a69a;
    --color-chart-elder-bear-power: #ef5350;
    /* Chart — Squeeze Momentum / 상태 점 */
    --color-chart-squeeze-momentum-up: #26a69a;
    --color-chart-squeeze-momentum-down: #ef5350;
    --color-chart-squeeze-on: #fbbf24;
    --color-chart-squeeze-off: #94a3b8;
    --color-chart-squeeze-none: #3b82f6;
    /* Chart — Regression */
    --color-chart-regression-up: #26a69a;
    --color-chart-regression-down: #ef5350;
```
(alpha 변형 `...Weak`는 JS 전용이라 미러하지 않는다.)

- [ ] **Step 4: Verify**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn lint src/shared/lib/chartColors.ts && npx prettier --check src/shared/lib/chartColors.ts src/app/globals.css`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/lib/chartColors.ts src/app/globals.css
git commit -m "feat(chart): add elderRay + squeeze + regression colors"
```

---

## Task 3: Histogram color pure functions

**Files:**
- Create: `src/widgets/chart/utils/histogramColorUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    regressionBarColor,
    squeezeMomentumColor,
    squeezeStateColor,
} from '@/widgets/chart/utils/histogramColorUtils';

describe('squeezeMomentumColor', () => {
    it('positive + increasing → strong up', () => {
        expect(squeezeMomentumColor(5, true)).toBe(CHART_COLORS.squeezeMomentumUp);
    });
    it('positive + not increasing → weak up', () => {
        expect(squeezeMomentumColor(5, false)).toBe(CHART_COLORS.squeezeMomentumUpWeak);
    });
    it('negative + increasing → weak down (recovering)', () => {
        expect(squeezeMomentumColor(-5, true)).toBe(CHART_COLORS.squeezeMomentumDownWeak);
    });
    it('negative + not increasing → strong down', () => {
        expect(squeezeMomentumColor(-5, false)).toBe(CHART_COLORS.squeezeMomentumDown);
    });
    it('zero counts as non-positive (weak/strong down by increasing)', () => {
        expect(squeezeMomentumColor(0, true)).toBe(CHART_COLORS.squeezeMomentumDownWeak);
        expect(squeezeMomentumColor(0, false)).toBe(CHART_COLORS.squeezeMomentumDown);
    });
    it('null increasing treated as not increasing', () => {
        expect(squeezeMomentumColor(5, null)).toBe(CHART_COLORS.squeezeMomentumUpWeak);
    });
});

describe('squeezeStateColor', () => {
    it('noSqz → squeezeNone (highest priority)', () => {
        expect(
            squeezeStateColor({ noSqz: true, sqzOn: true, sqzOff: false })
        ).toBe(CHART_COLORS.squeezeNone);
    });
    it('sqzOn → squeezeOn', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: true, sqzOff: false })
        ).toBe(CHART_COLORS.squeezeOn);
    });
    it('sqzOff → squeezeOff', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: false, sqzOff: true })
        ).toBe(CHART_COLORS.squeezeOff);
    });
    it('all false/null → null (no dot)', () => {
        expect(
            squeezeStateColor({ noSqz: false, sqzOn: false, sqzOff: false })
        ).toBeNull();
        expect(
            squeezeStateColor({ noSqz: null, sqzOn: null, sqzOff: null })
        ).toBeNull();
    });
});

describe('regressionBarColor', () => {
    it('positive slope → teal rgba with r2 alpha', () => {
        expect(regressionBarColor(2, 0.8)).toBe('rgba(38, 166, 154, 0.8)');
    });
    it('negative slope → red rgba with r2 alpha', () => {
        expect(regressionBarColor(-2, 0.5)).toBe('rgba(239, 83, 80, 0.5)');
    });
    it('clamps r2 into [0,1]', () => {
        expect(regressionBarColor(1, 1.7)).toBe('rgba(38, 166, 154, 1)');
        expect(regressionBarColor(1, -0.4)).toBe('rgba(38, 166, 154, 0)');
    });
    it('null r2 → fallback alpha 0.25', () => {
        expect(regressionBarColor(1, null)).toBe('rgba(38, 166, 154, 0.25)');
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/widgets/chart/utils/histogramColorUtils.ts`:
```ts
import { CHART_COLORS } from '@/shared/lib/chartColors';

/** Regression alpha 기본값 — r2가 null(신뢰도 미확정)일 때 흐릿하게. */
const REGRESSION_FALLBACK_ALPHA = 0.25;
/** Regression 막대 RGB(투명도만 r2로 변조) — DESIGN.md teal/red 고정값의 RGB 분해. */
const REGRESSION_UP_RGB = '38, 166, 154'; // #26a69a
const REGRESSION_DOWN_RGB = '239, 83, 80'; // #ef5350

/**
 * Squeeze 모멘텀 히스토그램 4색: 부호(상승/하락) × increasing(강/약).
 * value > 0: increasing이면 강한 상승, 아니면 약화. value ≤ 0: increasing이면
 * 회복(약한 하락), 아니면 강한 하락. (LazyBear 표준)
 */
export function squeezeMomentumColor(
    value: number,
    increasing: boolean | null
): string {
    if (value > 0) {
        return increasing
            ? CHART_COLORS.squeezeMomentumUp
            : CHART_COLORS.squeezeMomentumUpWeak;
    }
    return increasing
        ? CHART_COLORS.squeezeMomentumDownWeak
        : CHART_COLORS.squeezeMomentumDown;
}

/**
 * Squeeze 상태 점 색: noSqz > sqzOn > sqzOff 우선순위. 어느 상태도 아니면 null(점 없음).
 */
export function squeezeStateColor(row: {
    noSqz: boolean | null;
    sqzOn: boolean | null;
    sqzOff: boolean | null;
}): string | null {
    if (row.noSqz) return CHART_COLORS.squeezeNone;
    if (row.sqzOn) return CHART_COLORS.squeezeOn;
    if (row.sqzOff) return CHART_COLORS.squeezeOff;
    return null;
}

/**
 * Regression slope 막대 색: 부호로 teal/red, 투명도 = r2(적합도) 클램프.
 * r2 null이면 fallback alpha로 "신뢰도 미확정"을 흐리게 표현.
 */
export function regressionBarColor(slope: number, r2: number | null): string {
    const alpha =
        r2 === null ? REGRESSION_FALLBACK_ALPHA : Math.min(1, Math.max(0, r2));
    const rgb = slope >= 0 ? REGRESSION_UP_RGB : REGRESSION_DOWN_RGB;
    return `rgba(${rgb}, ${alpha})`;
}
```

- [ ] **Step 4: Run to verify it passes + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts
yarn lint src/widgets/chart/utils/histogramColorUtils.ts src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts
```
Expected: tsc clean; tests PASS; lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/utils/histogramColorUtils.ts src/widgets/chart/__tests__/utils/histogramColorUtils.test.ts
git commit -m "feat(chart): add squeeze/regression histogram color functions"
```

---

## Task 4: Register the 3 indicators

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write the failing registry tests**

In `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`: change the length assertion `toHaveLength(29)` → `toHaveLength(32)`, and add:
```ts
it('registers elderRay as a momentum pane', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'elderRay');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('momentum');
    expect(meta?.kind).toBe('pane');
});

it('registers squeezeMomentum as a momentum pane', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'squeezeMomentum');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('momentum');
    expect(meta?.kind).toBe('pane');
});

it('registers regression as a statistical pane', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'regression');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('statistical');
    expect(meta?.kind).toBe('pane');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add union members + registry entries**

In `src/widgets/chart/model/indicatorRegistry.ts`:
(a) In `IndicatorKey`, after `| 'chandelierExit'`, change the terminator to:
```ts
    | 'chandelierExit'
    | 'elderRay'
    | 'squeezeMomentum'
    | 'regression';
```
(b) In `INDICATOR_REGISTRY`, after the `chandelierExit` entry (last element, before `];`), add:
```ts
    { key: 'elderRay', label: 'Elder Ray', category: 'momentum', kind: 'pane' },
    {
        key: 'squeezeMomentum',
        label: 'Squeeze',
        category: 'momentum',
        kind: 'pane',
    },
    {
        key: 'regression',
        label: 'Regression',
        category: 'statistical',
        kind: 'pane',
    },
```

- [ ] **Step 4: Verify registry test passes**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix makePaneIndices fallout**

In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`, inside the `makePaneIndices` base object, after `chandelierExit: INACTIVE_PANE_INDEX,`, add:
```ts
        elderRay: INACTIVE_PANE_INDEX,
        squeezeMomentum: INACTIVE_PANE_INDEX,
        regression: INACTIVE_PANE_INDEX,
```

- [ ] **Step 6: tsc + both tests**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```
Expected: tsc clean; both PASS. If tsc flags other `Record<IndicatorKey>` objects missing the 3 keys, fix each and report.

- [ ] **Step 7: Commit**

```bash
git add src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): register elderRay + squeezeMomentum + regression panes"
```

---

## Task 5: `useElderRayChart` hook

**Files:**
- Create: `src/widgets/chart/hooks/useElderRayChart.ts`
- Test: `src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts`:
```ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useElderRayChart } from '../../hooks/useElderRayChart';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    HistogramSeries: 'HistogramSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useElderRayChart
    >[0]['chartRef'];
}

function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { elderRay: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    elderRay: [{ bullPower: 2, bearPower: -1 }],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useElderRayChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates two histogram series when visible', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(props => useElderRayChart(props), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: false,
            paneIndex: 1,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('does not set data when elderRay is empty', () => {
        renderHook(() =>
            useElderRayChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(props => useElderRayChart(props), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: true,
            paneIndex: 2,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the hook**

Create `src/widgets/chart/hooks/useElderRayChart.ts` (cloned from useMACDChart skeleton, 2 histograms):
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildSeriesData } from '../utils/seriesDataUtils';

interface UseElderRayChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useElderRayChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseElderRayChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const bullSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const bearSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        bullSeriesRef.current = null;
        bearSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (bullSeriesRef.current) {
            chart.removeSeries(bullSeriesRef.current);
            bullSeriesRef.current = null;
        }
        if (bearSeriesRef.current) {
            chart.removeSeries(bearSeriesRef.current);
            bearSeriesRef.current = null;
        }
    });

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

        if (prevPaneIndexRef.current !== paneIndex && bullSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!bullSeriesRef.current) {
            bullSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
        if (!bearSeriesRef.current) {
            bearSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { elderRay } = indicators;
        if (!elderRay.length) return;

        if (!bullSeriesRef.current || !bearSeriesRef.current) return;

        bullSeriesRef.current.setData(
            buildSeriesData(bars, elderRay, 'bullPower', value =>
                value >= 0 ? CHART_COLORS.elderBullPower : CHART_COLORS.neutral
            )
        );
        bearSeriesRef.current.setData(
            buildSeriesData(bars, elderRay, 'bearPower', value =>
                value <= 0 ? CHART_COLORS.elderBearPower : CHART_COLORS.neutral
            )
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
```

- [ ] **Step 4: Run to verify it passes + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts
yarn lint src/widgets/chart/hooks/useElderRayChart.ts src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts
```
Expected: all clean/PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/hooks/useElderRayChart.ts src/widgets/chart/__tests__/hooks/useElderRayChart.test.ts
git commit -m "feat(chart): add useElderRayChart hook (bull/bear power histograms)"
```

---

## Task 6: `useSqueezeMomentumChart` hook

**Files:**
- Create: `src/widgets/chart/hooks/useSqueezeMomentumChart.ts`
- Test: `src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts`:
```ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useSqueezeMomentumChart } from '../../hooks/useSqueezeMomentumChart';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    HistogramSeries: 'HistogramSeries',
    LineSeries: 'LineSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
    buildZeroLineDots: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useSqueezeMomentumChart
    >[0]['chartRef'];
}
function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { squeezeMomentum: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    squeezeMomentum: [
        { momentum: 3, sqzOn: true, sqzOff: false, noSqz: false, increasing: true },
    ],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useSqueezeMomentumChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates histogram + state-dots series when visible', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(2);
    });

    it('removes both series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useSqueezeMomentumChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: false,
            paneIndex: 1,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });

    it('sets data on both series when visible with data', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(2);
    });

    it('does not set data when squeezeMomentum is empty', () => {
        renderHook(() =>
            useSqueezeMomentumChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useSqueezeMomentumChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: true,
            paneIndex: 2,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `src/widgets/chart/hooks/useSqueezeMomentumChart.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries, LineSeries } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_POINT_MARKERS_RADIUS } from '../constants';
import { buildSeriesData, buildZeroLineDots } from '../utils/seriesDataUtils';
import {
    squeezeMomentumColor,
    squeezeStateColor,
} from '../utils/histogramColorUtils';

interface UseSqueezeMomentumChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useSqueezeMomentumChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseSqueezeMomentumChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const momentumSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const stateDotsSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        momentumSeriesRef.current = null;
        stateDotsSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (momentumSeriesRef.current) {
            chart.removeSeries(momentumSeriesRef.current);
            momentumSeriesRef.current = null;
        }
        if (stateDotsSeriesRef.current) {
            chart.removeSeries(stateDotsSeriesRef.current);
            stateDotsSeriesRef.current = null;
        }
    });

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

        if (
            prevPaneIndexRef.current !== paneIndex &&
            momentumSeriesRef.current
        ) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!momentumSeriesRef.current) {
            momentumSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
        if (!stateDotsSeriesRef.current) {
            stateDotsSeriesRef.current = chart.addSeries(
                LineSeries,
                {
                    lineVisible: false,
                    pointMarkersVisible: true,
                    pointMarkersRadius: DEFAULT_POINT_MARKERS_RADIUS,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { squeezeMomentum } = indicators;
        if (!squeezeMomentum.length) return;

        if (!momentumSeriesRef.current || !stateDotsSeriesRef.current) return;

        momentumSeriesRef.current.setData(
            buildSeriesData(bars, squeezeMomentum, 'momentum', (value, row) =>
                squeezeMomentumColor(value, row.increasing)
            )
        );
        stateDotsSeriesRef.current.setData(
            buildZeroLineDots(bars, squeezeMomentum, squeezeStateColor)
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
```

- [ ] **Step 4: Run to verify it passes + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts
yarn lint src/widgets/chart/hooks/useSqueezeMomentumChart.ts src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts
```
Expected: all clean/PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/hooks/useSqueezeMomentumChart.ts src/widgets/chart/__tests__/hooks/useSqueezeMomentumChart.test.ts
git commit -m "feat(chart): add useSqueezeMomentumChart hook (4-color histogram + state dots)"
```

---

## Task 7: `useRegressionChart` hook

**Files:**
- Create: `src/widgets/chart/hooks/useRegressionChart.ts`
- Test: `src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts`:
```ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { useRegressionChart } from '../../hooks/useRegressionChart';

const mockSetData = vi.fn();
const mockApplyOptions = vi.fn();
const mockRemoveSeries = vi.fn();
const mockAddSeries = vi.fn(() => ({
    setData: mockSetData,
    applyOptions: mockApplyOptions,
}));

vi.mock('lightweight-charts', () => ({
    HistogramSeries: 'HistogramSeries',
}));

vi.mock('../../utils/seriesDataUtils', () => ({
    buildSeriesData: vi.fn(() => []),
}));

function makeChartRef(chart: unknown = null) {
    return { current: chart } as Parameters<
        typeof useRegressionChart
    >[0]['chartRef'];
}
function makeChart() {
    return { addSeries: mockAddSeries, removeSeries: mockRemoveSeries };
}

const EMPTY_INDICATORS = { regression: [] } as unknown as IndicatorResult;
const FILLED_INDICATORS = {
    regression: [{ slope: 0.4, r2: 0.8 }],
} as unknown as IndicatorResult;
const FAKE_BARS: Bar[] = [
    { time: 1000, open: 1, high: 2, low: 0, close: 1, volume: 10 },
];

describe('useRegressionChart', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create series when chart is null', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(null),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).not.toHaveBeenCalled();
    });

    it('creates one histogram series when visible', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockAddSeries).toHaveBeenCalledTimes(1);
    });

    it('removes the series when not visible', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useRegressionChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: false,
            paneIndex: 1,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });

    it('sets data when visible with data', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).toHaveBeenCalledTimes(1);
    });

    it('does not set data when regression is empty', () => {
        renderHook(() =>
            useRegressionChart({
                chartRef: makeChartRef(makeChart()),
                bars: FAKE_BARS,
                indicators: EMPTY_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            })
        );
        expect(mockSetData).not.toHaveBeenCalled();
    });

    it('recreates the series when paneIndex changes', () => {
        const chart = makeChart();
        const { rerender } = renderHook(p => useRegressionChart(p), {
            initialProps: {
                chartRef: makeChartRef(chart),
                bars: FAKE_BARS,
                indicators: FILLED_INDICATORS,
                isVisible: true,
                paneIndex: 1,
            },
        });
        rerender({
            chartRef: makeChartRef(chart),
            bars: FAKE_BARS,
            indicators: FILLED_INDICATORS,
            isVisible: true,
            paneIndex: 2,
        });
        expect(mockRemoveSeries).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the hook**

Create `src/widgets/chart/hooks/useRegressionChart.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { HistogramSeries } from 'lightweight-charts';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { buildSeriesData } from '../utils/seriesDataUtils';
import { regressionBarColor } from '../utils/histogramColorUtils';

interface UseRegressionChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    isVisible: boolean;
    paneIndex: number;
}

export function useRegressionChart({
    chartRef,
    bars,
    indicators,
    isVisible,
    paneIndex,
}: UseRegressionChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const slopeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        slopeSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (slopeSeriesRef.current) {
            chart.removeSeries(slopeSeriesRef.current);
            slopeSeriesRef.current = null;
        }
    });

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

        if (prevPaneIndexRef.current !== paneIndex && slopeSeriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!slopeSeriesRef.current) {
            slopeSeriesRef.current = chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false },
                paneIndex
            );
        }
    }, [chartRef, isVisible, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;

        const { regression } = indicators;
        if (!regression.length) return;

        if (!slopeSeriesRef.current) return;

        slopeSeriesRef.current.setData(
            buildSeriesData(bars, regression, 'slope', (value, row) =>
                regressionBarColor(value, row.r2)
            )
        );
    }, [indicators, bars, isVisible, paneIndex]);
}
```

- [ ] **Step 4: Run to verify it passes + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts
yarn lint src/widgets/chart/hooks/useRegressionChart.ts src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts
```
Expected: all clean/PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/hooks/useRegressionChart.ts src/widgets/chart/__tests__/hooks/useRegressionChart.test.ts
git commit -m "feat(chart): add useRegressionChart hook (slope histogram + r2 opacity)"
```

---

## Task 8: Pane labels

**Files:**
- Modify: `src/widgets/chart/utils/paneLabelUtils.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write failing label tests**

In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`, add (inside the existing top-level describe for `buildPaneLabels`):
```ts
it('builds Elder Ray sub-labels (Bull Power, Bear Power) when active', () => {
    const labels = buildPaneLabels(makePaneIndices({ elderRay: 2 }));
    const elder = labels.find(l => l.paneIndex === 2);
    expect(elder?.subLabels.map(s => s.name)).toEqual([
        'Bull Power',
        'Bear Power',
    ]);
});

it('builds a Squeeze pane label when active', () => {
    const labels = buildPaneLabels(makePaneIndices({ squeezeMomentum: 3 }));
    expect(labels.find(l => l.paneIndex === 3)?.subLabels[0].name).toBe(
        'Squeeze'
    );
});

it('builds a Regression pane label when active', () => {
    const labels = buildPaneLabels(makePaneIndices({ regression: 4 }));
    expect(labels.find(l => l.paneIndex === 4)?.subLabels[0].name).toBe(
        'Regression'
    );
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn vitest run src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`
Expected: FAIL (labels not present).

- [ ] **Step 3: Implement the labels**

In `src/widgets/chart/utils/paneLabelUtils.ts`, add three label configs (place them next to the other single/multi-label definitions, before the `return [...]`). For Elder Ray (MACD-style inline, 2 sub-labels):
```ts
    const elderRayLabel: PaneLabelConfig[] =
        paneIndices.elderRay !== INACTIVE_PANE_INDEX
            ? [
                  {
                      paneIndex: paneIndices.elderRay,
                      subLabels: [
                          {
                              name: 'Bull Power',
                              color: CHART_COLORS.elderBullPower,
                          },
                          {
                              name: 'Bear Power',
                              color: CHART_COLORS.elderBearPower,
                          },
                      ],
                  },
              ]
            : [];
```
For Squeeze and Regression (single label via the existing helper):
```ts
    const squeezeLabel = buildSinglePaneLabel(
        paneIndices.squeezeMomentum,
        'Squeeze',
        CHART_COLORS.squeezeMomentumUp
    );
    const regressionLabel = buildSinglePaneLabel(
        paneIndices.regression,
        'Regression',
        CHART_COLORS.regressionUp
    );
```
Then add `...elderRayLabel`, `...squeezeLabel`, `...regressionLabel` to the `return [...]` array. (Confirm the exact spread/style matches how the file currently composes its return — match the existing pattern.)

- [ ] **Step 4: Run + tsc + lint**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
yarn lint src/widgets/chart/utils/paneLabelUtils.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```
Expected: all clean/PASS.

- [ ] **Step 5: Commit**

```bash
git add src/widgets/chart/utils/paneLabelUtils.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): add Elder Ray / Squeeze / Regression pane labels"
```

---

## Task 9: Wire into StockChart

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: Add imports + hook calls**

In `src/widgets/chart/StockChart.tsx`, add imports near the other pane-hook imports (e.g. after `useAtrChart`):
```ts
import { useElderRayChart } from './hooks/useElderRayChart';
import { useSqueezeMomentumChart } from './hooks/useSqueezeMomentumChart';
import { useRegressionChart } from './hooks/useRegressionChart';
```
Add three hook calls alongside the other pane hook calls (match the `useAtrChart({ chartRef, bars, indicators, isVisible: visible.atr, paneIndex: paneIndices.atr })` shape):
```ts
    useElderRayChart({
        chartRef,
        bars,
        indicators,
        isVisible: visible.elderRay,
        paneIndex: paneIndices.elderRay,
    });
    useSqueezeMomentumChart({
        chartRef,
        bars,
        indicators,
        isVisible: visible.squeezeMomentum,
        paneIndex: paneIndices.squeezeMomentum,
    });
    useRegressionChart({
        chartRef,
        bars,
        indicators,
        isVisible: visible.regression,
        paneIndex: paneIndices.regression,
    });
```
(Use the exact param object shape the sibling pane hooks use in this file — read `useAtrChart(...)` call and mirror it, including whether `bars`/`indicators` come from local vars.)

- [ ] **Step 2: Add 3 bindings (29→32)**

In the `indicatorBindings` useMemo, after the existing pane bindings (e.g. near `atr`/`yangZhang`/`ewmaVolatility`), add:
```ts
            {
                meta: INDICATOR_META.elderRay,
                active: visible.elderRay,
                onToggle: () => toggle('elderRay'),
            },
            {
                meta: INDICATOR_META.squeezeMomentum,
                active: visible.squeezeMomentum,
                onToggle: () => toggle('squeezeMomentum'),
            },
            {
                meta: INDICATOR_META.regression,
                active: visible.regression,
                onToggle: () => toggle('regression'),
            },
```
The `indicatorBindings` deps array already contains `visible` and `toggle` (the binding deps comment notes the whole `visible` object is a dep) — no per-key dep additions needed. Confirm `visible` and `toggle` are already in that deps array; if not, add them.

- [ ] **Step 3: tsc + chart suite**

Run:
```bash
cd /Users/y0ngha/Project/siglens-c-complex
npx tsc --noEmit
yarn vitest run src/widgets/chart
```
Expected: tsc clean; tests PASS. In `src/widgets/chart/__tests__/StockChart.test.tsx`, update the binding count test (name + `data-count`) from 29 to 32 and append `,elderRay,squeezeMomentum,regression` to the expected `data-keys` string (in that order — they are appended after chandelierExit). Report what you changed.

- [ ] **Step 4: Commit**

```bash
git add src/widgets/chart/StockChart.tsx src/widgets/chart/__tests__/StockChart.test.tsx
git commit -m "feat(chart): wire elderRay + squeeze + regression panes into StockChart (32 bindings)"
```

---

## Task 10: E2E pane toggles

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: Read the existing pane-toggle test (MFI/ATR)**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && grep -n "into a pane\|pane-indicator-label\|닫기\|GEAR" e2e/specs/chart-indicators.spec.ts`
Expected: shows the "toggles MFI into a pane" / "toggles ATR into a pane" test shape (open modal → check checkbox → close modal → assert `.pane-indicator-label` contains the name).

- [ ] **Step 2: Add three pane-toggle tests**

In `e2e/specs/chart-indicators.spec.ts`, add three tests mirroring the EXACT structure of the existing ATR/MFI "toggles … into a pane" test (open modal via `GEAR`, check the checkbox with `exact: true`, close modal via the `닫기` button, assert the pane label is visible). Use checkbox names `'Elder Ray'`, `'Squeeze'`, `'Regression'` and assert their pane labels (`Bull Power` / `Squeeze` / `Regression`) appear in `.pane-indicator-label`. Copy the ATR test body verbatim and substitute the names — do NOT invent a different structure. If the ATR test asserts a specific label string in `.pane-indicator-label`, mirror that assertion style for:
- Elder Ray → label text `Bull Power` (first sub-label)
- Squeeze → label text `Squeeze`
- Regression → label text `Regression`

- [ ] **Step 3: Lint + tsc**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn lint e2e/specs/chart-indicators.spec.ts && npx tsc --noEmit`
Expected: clean. (Do NOT run the Playwright suite locally — shared docker backend; CI is the gate.)

- [ ] **Step 4: Commit**

```bash
git add e2e/specs/chart-indicators.spec.ts
git commit -m "test(e2e): toggle Elder Ray / Squeeze / Regression panes from settings modal"
```

---

## Task 11: Final verification + review handoff

**Files:** none

- [ ] **Step 1: Full coverage suite**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn test-coverage > /tmp/c-complex-cov.log 2>&1; echo "EXIT=$?"; tail -8 /tmp/c-complex-cov.log`
Expected: `EXIT=0`, thresholds (90%+) met.

- [ ] **Step 2: Lint + format (whole repo)**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn lint && npx prettier --check .`
Expected: no errors.

- [ ] **Step 3: Production build (capture exit code directly)**

Run: `cd /Users/y0ngha/Project/siglens-c-complex && yarn build > /tmp/c-complex-build.log 2>&1; echo "EXIT=$?"; tail -12 /tmp/c-complex-build.log`
Expected: `EXIT=0`.

- [ ] **Step 4: Hand off to review**

Per CLAUDE.md routing: invoke `review-agent` (Opus 4.8) on branch `feat/render-c-complex`, then `mistake-managing-agent`, then `git-agent` to push and open the PR stacked on `feat/render-group-a-rest` (#584). Do not merge before APPROVED.

---

## Self-Review

**Spec coverage:**
- §3.1 row-aware buildSeriesData colorFn → Task 1. ✓
- §3.2 buildZeroLineDots → Task 1. ✓
- §4.1 useElderRayChart (2 histograms) → Task 5. ✓
- §4.2 useSqueezeMomentumChart (histogram + state dots) → Task 6. ✓ (color fns Task 3)
- §4.3 useRegressionChart (slope histogram + r2 opacity) → Task 7. ✓ (regressionBarColor Task 3)
- §5 colors + @theme → Task 2. ✓
- §6.1 registry +3 (29→32, makePaneIndices, StockChart.test) → Task 4 + Task 9. ✓
- §6.2 pane labels → Task 8. ✓
- §6.3 StockChart wiring → Task 9. ✓
- §8.4 E2E ×3 → Task 10. ✓
- §8 test strategy (90%+, happy + worst) → Tasks 1/3/5/6/7 cover null rows, empty, length mismatch, 4-color branches, state priority, r2 clamp/null, paneIndex change. ✓

**Placeholder scan:** No TBD/TODO. Task 8 (paneLabelUtils return composition) and Task 9/10 (matching sibling shape) instruct reading the exact existing pattern rather than guessing — the code to add is fully specified; only the insertion-into-existing-array style is "match existing", which is unavoidable without duplicating the whole file.

**Type consistency:** `buildSeriesData(bars, data, key, (value, row, index) => string)` signature consistent across Tasks 1/5/6/7. `buildZeroLineDots(bars, data, (row) => string|null)` consistent Tasks 1/6. Color fns `squeezeMomentumColor(value, increasing)`, `squeezeStateColor(row)`, `regressionBarColor(slope, r2)` consistent between Task 3 defs and Task 6/7 calls. Registry count 29→32 consistent Tasks 4/9. Pane keys `elderRay`/`squeezeMomentum`/`regression` consistent throughout. `DEFAULT_POINT_MARKERS_RADIUS` reused from constants (added in #584). ✓
