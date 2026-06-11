# Elder Impulse (candle-paint) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolor the main candlestick series per-bar by Elder Impulse momentum (green/red/blue) when the indicator is toggled on.

**Architecture:** Elder Impulse is NOT a separate series — it injects per-bar `color`/`borderColor`/`wickColor` into the existing main `CandlestickSeries` data. The inline OHLC map in StockChart's candle setData effect is extracted into a pure `buildCandlestickData(bars, elderImpulse, isActive)` helper so the injection logic is testable in isolation. A new registry kind `candle-paint` (not a pane, not a separate overlay series) carries it; visibility uses `useIndicatorVisibility`'s `visible.elderImpulse` / `toggle('elderImpulse')`. Computation is in `@y0ngha/siglens-core` (unchanged).

**Tech Stack:** TypeScript, React 19, lightweight-charts 5.2.0 (`CandlestickData` per-point color), Vitest + RTL, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-render-elder-impulse-design.md`
**Branch:** `feat/render-elder-impulse` (base: `feat/render-c-complex` = PR #585)
**Worktree:** `/Users/y0ngha/Project/siglens-elder-impulse`

**Data shape (siglens-core):** `type ImpulseColor = 'green' | 'red' | 'blue'`; `IndicatorResult.elderImpulse: (ImpulseColor | null)[]`.

**Key existing code:**
- StockChart candle setData effect (StockChart.tsx ~179–194), deps `[bars]`:
  ```ts
  seriesRef.current.setData(bars.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close })));
  chartRef.current.timeScale().fitContent();
  ```
- `useIndicatorVisibility()` at StockChart.tsx:117 (provides `visible`, `toggle`) — BEFORE the candle effect, so `visible.elderImpulse` is in scope.
- `IndicatorKind = 'overlay' | 'pane'` (indicatorRegistry.ts:18). `CHART_COLORS` ends after `regressionDown` (chartColors.ts:161). globals.css regression tokens at 73–74.

---

## File Structure

- `src/shared/lib/chartColors.ts` + `src/app/globals.css` — 3 impulse colors + @theme tokens (modify).
- `src/widgets/chart/utils/candlestickDataUtils.ts` (+ test) — `impulseColor` + `buildCandlestickData` (create).
- `src/widgets/chart/model/indicatorRegistry.ts` (+ tests, + paneLabelUtils test) — `IndicatorKind` += candle-paint, `IndicatorKey` += elderImpulse, 32→33 (modify).
- `src/widgets/chart/StockChart.tsx` (+ test) — candle effect uses helper, +1 binding (modify).
- `e2e/specs/chart-indicators.spec.ts` — modal-checkbox toggle test (modify).

---

## Task 0: Worktree node_modules verify

**Files:** none

- [ ] **Step 1:** Run:
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse
[ -e node_modules/.bin/vitest ] && [ ! -L node_modules ] && echo "OK" || echo "MISSING"
```
Expected `OK`. If MISSING: `cp -al /Users/y0ngha/Project/siglens/node_modules ./node_modules && rm -rf node_modules/node_modules`.

- [ ] **Step 2:** `cd /Users/y0ngha/Project/siglens-elder-impulse && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` → PASS.

---

## Task 1: Add impulse colors

**Files:**
- Modify: `src/shared/lib/chartColors.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Collision guard**

```bash
cd /Users/y0ngha/Project/siglens-elder-impulse
grep -rn "impulseBullish\|impulseBearish\|impulseNeutral" src/ || echo "KEYS UNUSED — safe"
```
Expected: `KEYS UNUSED — safe`.

- [ ] **Step 2:** In `src/shared/lib/chartColors.ts`, immediately AFTER `regressionDown: '#ef5350',` (the last entry before `} as const;`), add:
```ts
    // Elder Impulse (캔들 per-bar 색) — DESIGN.md teal/red + Elder blue 관례
    impulseBullish: '#26a69a', // green — EMA↑ & MACD-hist↑
    impulseBearish: '#ef5350', // red — 둘 다 ↓
    impulseNeutral: '#3b82f6', // blue — 혼조/전환
```

- [ ] **Step 3:** In `src/app/globals.css`, AFTER `--color-chart-regression-down: #ef5350;`, add:
```css
    /* Chart — Elder Impulse (캔들 색) */
    --color-chart-impulse-bullish: #26a69a;
    --color-chart-impulse-bearish: #ef5350;
    --color-chart-impulse-neutral: #3b82f6;
```

- [ ] **Step 4:** Verify:
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse && yarn lint src/shared/lib/chartColors.ts && npx prettier --check src/shared/lib/chartColors.ts src/app/globals.css
```
Expected: clean.

- [ ] **Step 5: Commit**
```bash
git add src/shared/lib/chartColors.ts src/app/globals.css
git commit -m "feat(chart): add Elder Impulse candle colors"
```

---

## Task 2: `buildCandlestickData` + `impulseColor` utils

**Files:**
- Create: `src/widgets/chart/utils/candlestickDataUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    buildCandlestickData,
    impulseColor,
} from '@/widgets/chart/utils/candlestickDataUtils';

function bar(time: number, close = 10): Bar {
    return { time, open: 9, high: 11, low: 8, close, volume: 100 };
}

describe('impulseColor', () => {
    it('maps green/red/blue to the impulse palette', () => {
        expect(impulseColor('green')).toBe(CHART_COLORS.impulseBullish);
        expect(impulseColor('red')).toBe(CHART_COLORS.impulseBearish);
        expect(impulseColor('blue')).toBe(CHART_COLORS.impulseNeutral);
    });
});

describe('buildCandlestickData', () => {
    const bars: Bar[] = [bar(1), bar(2), bar(3)];

    it('returns plain OHLC (no color fields) when impulse is inactive', () => {
        const out = buildCandlestickData(
            bars,
            ['green', 'red', 'blue'],
            false
        );
        expect(out).toEqual([
            { time: 1, open: 9, high: 11, low: 8, close: 10 },
            { time: 2, open: 9, high: 11, low: 8, close: 10 },
            { time: 3, open: 9, high: 11, low: 8, close: 10 },
        ]);
        out.forEach(p => expect('color' in p).toBe(false));
    });

    it('injects color/borderColor/wickColor when active and color present', () => {
        const out = buildCandlestickData([bar(1)], ['green'], true);
        expect(out[0]).toEqual({
            time: 1,
            open: 9,
            high: 11,
            low: 8,
            close: 10,
            color: CHART_COLORS.impulseBullish,
            borderColor: CHART_COLORS.impulseBullish,
            wickColor: CHART_COLORS.impulseBullish,
        });
    });

    it('leaves a bar plain when active but its impulse is null (warm-up)', () => {
        const out = buildCandlestickData([bar(1), bar(2)], [null, 'red'], true);
        expect('color' in out[0]).toBe(false);
        expect(out[1].color).toBe(CHART_COLORS.impulseBearish);
    });

    it('leaves bars plain when the impulse array is shorter than bars', () => {
        const out = buildCandlestickData([bar(1), bar(2)], ['green'], true);
        expect(out[0].color).toBe(CHART_COLORS.impulseBullish);
        expect('color' in out[1]).toBe(false); // index 1 → undefined → plain
    });

    it('returns [] for empty bars', () => {
        expect(buildCandlestickData([], [], true)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn vitest run src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/widgets/chart/utils/candlestickDataUtils.ts`:
```ts
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

/** Elder Impulse 색 매핑: green=강세(teal), red=약세(red), blue=혼조(blue). */
export function impulseColor(c: ImpulseColor): string {
    if (c === 'green') return CHART_COLORS.impulseBullish;
    if (c === 'red') return CHART_COLORS.impulseBearish;
    return CHART_COLORS.impulseNeutral;
}

/**
 * 메인 캔들스틱 시리즈 데이터를 만든다. Elder Impulse가 활성이고 해당 bar의 색이
 * 있으면 per-bar color/borderColor/wickColor를 주입해 시리즈 기본 bull/bear 색을
 * override한다. 비활성이거나 warm-up(null)·배열 범위 밖이면 plain OHLC를 반환해
 * 시리즈 기본 색이 그대로 적용되게 한다.
 */
export function buildCandlestickData(
    bars: Bar[],
    elderImpulse: (ImpulseColor | null)[],
    isImpulseActive: boolean
): CandlestickData<UTCTimestamp>[] {
    return bars.map(bar => {
        const base: CandlestickData<UTCTimestamp> = {
            // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일.
            time: bar.time as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        };
        return base;
    }).map((base, i) => {
        if (!isImpulseActive) return base;
        const impulse = elderImpulse[i];
        if (impulse == null) return base;
        const color = impulseColor(impulse);
        return { ...base, color, borderColor: color, wickColor: color };
    });
}
```
NOTE: the two-`.map` split keeps the base build and the color-inject pass readable; a single map is also acceptable. If the reviewer prefers one map, that's fine — keep it pure and branch-covered.

- [ ] **Step 4: Run + tsc + lint**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts
yarn lint src/widgets/chart/utils/candlestickDataUtils.ts src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts
```
Expected: all clean/PASS.

- [ ] **Step 5: Commit**
```bash
git add src/widgets/chart/utils/candlestickDataUtils.ts src/widgets/chart/__tests__/utils/candlestickDataUtils.test.ts
git commit -m "feat(chart): add buildCandlestickData + impulseColor (Elder Impulse paint)"
```

---

## Task 3: Register elderImpulse (new `candle-paint` kind)

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write the failing registry test**

In `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`: change `toHaveLength(32)` → `toHaveLength(33)`, and add:
```ts
it('registers elderImpulse as a candle-paint indicator', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'elderImpulse');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('momentum');
    expect(meta?.kind).toBe('candle-paint');
});
```

- [ ] **Step 2: Run to verify it fails**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` → FAIL.

- [ ] **Step 3: Implement**

In `src/widgets/chart/model/indicatorRegistry.ts`:
(a) Extend the kind union (line 18):
```ts
export type IndicatorKind = 'overlay' | 'pane' | 'candle-paint';
```
(b) In `IndicatorKey`, after `| 'regression'`, change the terminator to:
```ts
    | 'regression'
    | 'elderImpulse';
```
(c) In `INDICATOR_REGISTRY`, after the `regression` entry (last element, before `];`), add:
```ts
    {
        key: 'elderImpulse',
        label: 'Elder Impulse',
        category: 'momentum',
        kind: 'candle-paint',
    },
```

- [ ] **Step 4: Verify registry test PASS**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` → PASS.

- [ ] **Step 5: Fix makePaneIndices fallout**

In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`, inside `makePaneIndices`, after `regression: INACTIVE_PANE_INDEX,`, add:
```ts
        elderImpulse: INACTIVE_PANE_INDEX,
```

- [ ] **Step 6: tsc + tests**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts
```
Expected: tsc clean; all PASS. tsc may flag OTHER `Record<IndicatorKey>` objects (e.g. in useIndicatorVisibility or its test) needing the `elderImpulse` key — fix each (add `elderImpulse` with the appropriate default; for visibility `false`, for pane indices INACTIVE) and report which files. Also: `useIndicatorVisibility` filters `kind === 'pane'`, so `candle-paint` is naturally excluded from pane allocation — confirm its test still passes and that `visible.elderImpulse` initializes to `false`.

- [ ] **Step 7: Lint**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse && yarn lint src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```

- [ ] **Step 8: Commit**
```bash
git add src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): register elderImpulse (candle-paint kind)"
```

---

## Task 4: Wire into StockChart

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: Import the helper**

In `src/widgets/chart/StockChart.tsx`, add near the other util imports:
```ts
import { buildCandlestickData } from './utils/candlestickDataUtils';
```

- [ ] **Step 2: Use the helper in the candle setData effect**

Replace the candle setData effect body (the `seriesRef.current.setData(bars.map(...))` call, ~lines 182–191) with:
```ts
        seriesRef.current.setData(
            buildCandlestickData(
                bars,
                indicators.elderImpulse,
                visible.elderImpulse
            )
        );
```
Update that effect's deps array from `[bars]` to:
```ts
    }, [bars, indicators.elderImpulse, visible.elderImpulse]);
```
(`fitContent()` call stays. `indicators` and `visible` are already in scope — `useIndicatorVisibility` is at line 117, this effect is at ~179.)

- [ ] **Step 3: Add the binding (32→33)**

In the `indicatorBindings` useMemo, after the last existing binding (e.g. `regression`), add:
```ts
            {
                meta: INDICATOR_META.elderImpulse,
                active: visible.elderImpulse,
                onToggle: () => toggle('elderImpulse'),
            },
```
`visible` and `toggle` are already in that useMemo's deps — confirm; if not, add them.

- [ ] **Step 4: tsc + chart suite**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse
npx tsc --noEmit
yarn vitest run src/widgets/chart
```
Expected: tsc clean; tests PASS. In `src/widgets/chart/__tests__/StockChart.test.tsx`:
- Update the binding-count test (name + `data-count`) from 32 to 33 and append `,elderImpulse` to the expected `data-keys` string (after `regression`).
- If StockChart.test mocks `useIndicatorVisibility`, its `visible` object needs `elderImpulse: false` (and any INACTIVE_PANES-style list does NOT include it since it is not a pane — confirm the candle setData path renders without error). 
- If a candle-render assertion exists, ensure it still holds (default toggle off → plain OHLC, unchanged behavior).
Report exactly what you changed.

- [ ] **Step 5: Lint**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse && yarn lint src/widgets/chart/StockChart.tsx
```

- [ ] **Step 6: Commit**
```bash
git add src/widgets/chart/StockChart.tsx src/widgets/chart/__tests__/StockChart.test.tsx
git commit -m "feat(chart): wire Elder Impulse candle-paint into StockChart (33 bindings)"
```

---

## Task 5: E2E modal toggle

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: Add the toggle test**

Elder Impulse paints the main candles — it has no pane label and no overlay legend, so verify via the modal checkbox state (the Keltner/Supertrend overlay pattern). Add, immediately after the last existing test in the `test.describe('chart indicator settings modal', ...)` block (and before the describe's closing `});`):
```ts

    test('toggles the Elder Impulse candle paint via the modal', async ({
        page,
    }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        const dialog = page.getByRole('dialog');
        // Elder Impulse는 메인 캔들을 재색칠(candle-paint) — pane/overlay 라벨이 없어
        // 모달 체크박스 상태로 검증한다. exact로 substring 충돌 방지.
        const impulse = dialog.getByRole('checkbox', {
            name: 'Elder Impulse',
            exact: true,
        });
        await expect(impulse).not.toBeChecked();
        await impulse.check();
        await expect(impulse).toBeChecked();
    });
```
READ the file first to find the last test + the describe-closing `});`; `GEAR` is the const at the top of the describe.

- [ ] **Step 2: Lint + tsc**
```bash
cd /Users/y0ngha/Project/siglens-elder-impulse && yarn lint e2e/specs/chart-indicators.spec.ts && npx tsc --noEmit
```
Expected: clean. (Do NOT run Playwright locally — shared docker backend; CI is the gate.)

- [ ] **Step 3: Commit**
```bash
git add e2e/specs/chart-indicators.spec.ts
git commit -m "test(e2e): toggle Elder Impulse candle paint from settings modal"
```

---

## Task 6: Final verification + review handoff

**Files:** none

- [ ] **Step 1: Full coverage suite**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn test-coverage > /tmp/elder-cov.log 2>&1; echo "EXIT=$?"; tail -8 /tmp/elder-cov.log`
Expected: `EXIT=0`, thresholds (90%+) met.

- [ ] **Step 2: Lint + format (whole repo)**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn lint && npx prettier --check .`
Expected: no errors.

- [ ] **Step 3: Production build (capture exit code directly)**

`cd /Users/y0ngha/Project/siglens-elder-impulse && yarn build > /tmp/elder-build.log 2>&1; echo "EXIT=$?"; tail -12 /tmp/elder-build.log`
Expected: `EXIT=0`.

- [ ] **Step 4: Hand off to review**

Per CLAUDE.md routing: invoke `review-agent` (Opus 4.8) on branch `feat/render-elder-impulse`, then `mistake-managing-agent`, then `git-agent` to push and open the PR stacked on `feat/render-c-complex` (#585). Do not merge before APPROVED.

---

## Self-Review

**Spec coverage:**
- §3.1 buildCandlestickData → Task 2. ✓
- §3.2 impulseColor → Task 2. ✓
- §3.3 colors + @theme → Task 1. ✓
- §3.4 registry (candle-paint kind, 32→33, makePaneIndices, useIndicatorVisibility fallout) → Task 3. ✓
- §3.5 StockChart wiring (candle effect + binding) → Task 4. ✓
- §5.4 E2E → Task 5. ✓
- §5 test strategy (90%+, happy + worst) → Task 2 covers inactive/active/null/short-array/empty; Task 3 covers candle-paint kind; Task 4 covers binding + toggle. ✓

**Placeholder scan:** No TBD/TODO. Task 3 Step 6 and Task 4 Step 4 instruct fixing tsc-flagged `Record<IndicatorKey>` fallout sites "as flagged" — this is unavoidable discovery (the exact set depends on which objects enumerate all keys), but the fix per site is fully specified (add `elderImpulse` with the documented default).

**Type consistency:** `buildCandlestickData(bars, elderImpulse, isActive)` and `impulseColor(c)` signatures consistent across Task 2 (def) and Task 4 (call). Color keys `impulseBullish/Bearish/Neutral` consistent across Tasks 1/2. Registry count 32→33 consistent Tasks 3/4. `candle-paint` kind consistent Tasks 3/4. ✓
