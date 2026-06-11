# SMC Zones (zone kind) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render SMC premium/discount/equilibrium price bands as price lines on the main candlestick series when toggled on.

**Architecture:** SMC zones are drawn with `series.createPriceLine` on the existing candlestick series — mirroring `useActionRecommendationOverlay` (seriesRef + priceLinesRef[] + isVisible gating + remove-all-and-recreate on change). A pure `buildSmcZoneLines(smc)` helper converts the SMCResult zones into price-line specs (premium/discount as high+low bands, equilibrium as a single 50% midline). A new registry kind `zone` (not a pane, not a separate series) carries it. Computation is in `@y0ngha/siglens-core` (unchanged).

**Tech Stack:** TypeScript, React 19, lightweight-charts 5.2.0 (`createPriceLine`/`removePriceLine`), Vitest + RTL, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-render-smc-zones-design.md`
**Branch:** `feat/render-smc-zones` (base: `feat/render-elder-impulse` = PR #587)
**Worktree:** `/Users/y0ngha/Project/siglens-smc-zones`

**Data shapes (siglens-core):**
```ts
type SMCZoneType = 'premium' | 'discount' | 'equilibrium';
interface SMCZone { high: number; low: number; type: SMCZoneType; }
// SMCResult.premiumZone / discountZone / equilibriumZone: SMCZone | null
// IndicatorResult.smc: SMCResult
```

**Reference / key existing code:**
- `src/widgets/chart/hooks/useActionRecommendationOverlay.ts` — the createPriceLine pattern (seriesRef, priceLinesRef, isVisible, remove-all + recreate). EXACT template.
- StockChart: `seriesRef` (candle series, line ~110); `useActionRecommendationOverlay({ seriesRef, ..., isVisible })` call at line ~362; `INDICATOR_META` imported (line 70); last binding `elderImpulse` (line ~615); `indicatorBindings` deps already include `visible`/`toggle`.
- `CHART_COLORS` ends after `impulseNeutral` (chartColors.ts:165, `} as const` at 166). globals.css impulse tokens at 77–78.
- `IndicatorKind = 'overlay' | 'pane' | 'candle-paint'` (indicatorRegistry.ts). `smc` category already in `CATEGORY_LABELS` ('SMC').

---

## File Structure

- `src/shared/lib/chartColors.ts` + `src/app/globals.css` — 3 smc colors + @theme tokens (modify).
- `src/widgets/chart/utils/smcZoneUtils.ts` (+ test) — `buildSmcZoneLines` (create).
- `src/widgets/chart/model/indicatorRegistry.ts` (+ tests, + paneLabelUtils test) — IndicatorKind += 'zone', IndicatorKey += smc, 33→34 (modify).
- `src/widgets/chart/hooks/useSmcZones.ts` (+ test) — price-line hook (create).
- `src/widgets/chart/StockChart.tsx` (+ test) — useSmcZones call + 1 binding (34) (modify).
- `e2e/specs/chart-indicators.spec.ts` — modal-checkbox toggle test (modify).

---

## Task 0: Worktree node_modules verify

**Files:** none

- [ ] **Step 1:** This worktree was clean-installed (NOT hardlinked) to match the pinned `@y0ngha/siglens-core@0.20.0`. Verify:
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
grep '"version"' node_modules/@y0ngha/siglens-core/package.json | head -1
```
Expected: `0.20.0`. If it shows `0.21.1` or node_modules is missing: `rm -rf node_modules && yarn install` (do NOT `cp -al` from the main repo — its core drifted to 0.21.1).

- [ ] **Step 2:** `cd /Users/y0ngha/Project/siglens-smc-zones && yarn vitest run src/widgets/chart/__tests__/hooks/useActionRecommendationOverlay.test.ts` → PASS (confirms toolchain + the reference hook's test).

---

## Task 1: Add SMC zone colors

**Files:**
- Modify: `src/shared/lib/chartColors.ts`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Collision guard**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
grep -rn "smcPremium\|smcDiscount\|smcEquilibrium" src/ || echo "KEYS UNUSED — safe"
```
Expected: `KEYS UNUSED — safe`.

- [ ] **Step 2:** In `src/shared/lib/chartColors.ts`, immediately AFTER the `impulseNeutral: ...` line (the last entry before `} as const;`), add:
```ts
    // SMC zones (가격 밴드 경계선) — DESIGN.md bearish/bullish/neutral 매핑
    smcPremium: '#ef5350', // 매도/저항 상단
    smcDiscount: '#26a69a', // 매수/지지 하단
    smcEquilibrium: '#94a3b8', // 50% 공정가 (neutral)
```

- [ ] **Step 3:** In `src/app/globals.css`, AFTER the `--color-chart-impulse-neutral: #3b82f6;` line, add:
```css
    /* Chart — SMC zones */
    --color-chart-smc-premium: #ef5350;
    --color-chart-smc-discount: #26a69a;
    --color-chart-smc-equilibrium: #94a3b8;
```

- [ ] **Step 4:** Verify:
```bash
cd /Users/y0ngha/Project/siglens-smc-zones && yarn lint src/shared/lib/chartColors.ts && npx prettier --check src/shared/lib/chartColors.ts src/app/globals.css
```
Expected: clean.

- [ ] **Step 5: Commit** (DO NOT --no-verify; hook must pass)
```bash
git add src/shared/lib/chartColors.ts src/app/globals.css
git commit -m "feat(chart): add SMC zone colors"
```

---

## Task 2: `buildSmcZoneLines` helper

**Files:**
- Create: `src/widgets/chart/utils/smcZoneUtils.ts`
- Test: `src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { SMCResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import { buildSmcZoneLines } from '@/widgets/chart/utils/smcZoneUtils';

function smc(overrides: Partial<SMCResult>): SMCResult {
    return {
        swingHighs: [],
        swingLows: [],
        orderBlocks: [],
        fairValueGaps: [],
        equalHighs: [],
        equalLows: [],
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
        structureBreaks: [],
        ...overrides,
    };
}

describe('buildSmcZoneLines', () => {
    it('returns [] for undefined smc', () => {
        expect(buildSmcZoneLines(undefined)).toEqual([]);
    });

    it('returns [] when all zones are null', () => {
        expect(buildSmcZoneLines(smc({}))).toEqual([]);
    });

    it('builds 5 lines when all three zones present (premium/discount 2 each + equilibrium 1)', () => {
        const out = buildSmcZoneLines(
            smc({
                premiumZone: { high: 110, low: 105, type: 'premium' },
                discountZone: { high: 95, low: 90, type: 'discount' },
                equilibriumZone: { high: 101, low: 99, type: 'equilibrium' },
            })
        );
        expect(out).toEqual([
            { price: 110, color: CHART_COLORS.smcPremium, title: 'Premium' },
            { price: 105, color: CHART_COLORS.smcPremium, title: '' },
            { price: 95, color: CHART_COLORS.smcDiscount, title: 'Discount' },
            { price: 90, color: CHART_COLORS.smcDiscount, title: '' },
            { price: 100, color: CHART_COLORS.smcEquilibrium, title: 'Equilibrium' },
        ]);
    });

    it('equilibrium line uses the (high+low)/2 midpoint', () => {
        const out = buildSmcZoneLines(
            smc({ equilibriumZone: { high: 102, low: 98, type: 'equilibrium' } })
        );
        expect(out).toEqual([
            { price: 100, color: CHART_COLORS.smcEquilibrium, title: 'Equilibrium' },
        ]);
    });

    it('skips null zones independently (premium only)', () => {
        const out = buildSmcZoneLines(
            smc({ premiumZone: { high: 110, low: 105, type: 'premium' } })
        );
        expect(out).toEqual([
            { price: 110, color: CHART_COLORS.smcPremium, title: 'Premium' },
            { price: 105, color: CHART_COLORS.smcPremium, title: '' },
        ]);
    });
});
```

- [ ] **Step 2: Run to verify it fails**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn vitest run src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/widgets/chart/utils/smcZoneUtils.ts`:
```ts
import type { SMCResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

export interface SmcZoneLine {
    price: number;
    color: string;
    title: string;
}

/**
 * SMC premium/discount/equilibrium 존을 가격선 스펙으로 변환한다.
 * premium·discount는 high/low 밴드(2선, 대표 high선에만 title), equilibrium은 50% 공정가 1선.
 * null 존은 스킵 — 최대 5선.
 */
export function buildSmcZoneLines(smc: SMCResult | undefined): SmcZoneLine[] {
    if (!smc) return [];
    const lines: SmcZoneLine[] = [];
    const { premiumZone, discountZone, equilibriumZone } = smc;
    if (premiumZone) {
        lines.push({
            price: premiumZone.high,
            color: CHART_COLORS.smcPremium,
            title: 'Premium',
        });
        lines.push({
            price: premiumZone.low,
            color: CHART_COLORS.smcPremium,
            title: '',
        });
    }
    if (discountZone) {
        lines.push({
            price: discountZone.high,
            color: CHART_COLORS.smcDiscount,
            title: 'Discount',
        });
        lines.push({
            price: discountZone.low,
            color: CHART_COLORS.smcDiscount,
            title: '',
        });
    }
    if (equilibriumZone) {
        lines.push({
            price: (equilibriumZone.high + equilibriumZone.low) / 2,
            color: CHART_COLORS.smcEquilibrium,
            title: 'Equilibrium',
        });
    }
    return lines;
}
```

- [ ] **Step 4: Run + tsc + lint**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts
yarn lint src/widgets/chart/utils/smcZoneUtils.ts src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts
```
Expected: all clean/PASS.

- [ ] **Step 5: Commit**
```bash
git add src/widgets/chart/utils/smcZoneUtils.ts src/widgets/chart/__tests__/utils/smcZoneUtils.test.ts
git commit -m "feat(chart): add buildSmcZoneLines helper"
```

---

## Task 3: Register smc (new `zone` kind)

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: Write the failing registry tests**

In `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`: change `toHaveLength(33)` → `toHaveLength(34)`; add:
```ts
it('registers smc as a zone indicator in the smc category', () => {
    const meta = INDICATOR_REGISTRY.find(m => m.key === 'smc');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('smc');
    expect(meta?.kind).toBe('zone');
});

it('groupBindingsByCategory surfaces the SMC group once an smc binding exists', () => {
    const groups = groupBindingsByCategory([
        { meta: INDICATOR_META.smc, active: false, onToggle: () => {} },
    ]);
    expect(groups.find(g => g.category === 'smc')?.label).toBe('SMC');
});
```
(Ensure `groupBindingsByCategory` and `INDICATOR_META` are imported in this test file — add to the existing import if missing.)

- [ ] **Step 2: Run to verify it fails**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` → FAIL.

- [ ] **Step 3: Implement**

In `src/widgets/chart/model/indicatorRegistry.ts`:
(a) Extend the kind union:
```ts
export type IndicatorKind = 'overlay' | 'pane' | 'candle-paint' | 'zone';
```
(b) In `IndicatorKey`, after `| 'elderImpulse'`, change the terminator to:
```ts
    | 'elderImpulse'
    | 'smc';
```
(c) In `INDICATOR_REGISTRY`, after the `elderImpulse` entry (last, before `];`), add:
```ts
    { key: 'smc', label: 'SMC Zones', category: 'smc', kind: 'zone' },
```

- [ ] **Step 4: Verify registry test PASS**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` → PASS.

- [ ] **Step 5: Fix makePaneIndices fallout**

In `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts` `makePaneIndices` base object, after `elderImpulse: INACTIVE_PANE_INDEX,`, add:
```ts
        smc: INACTIVE_PANE_INDEX,
```

- [ ] **Step 6: tsc + tests**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts
```
tsc clean; all PASS. If tsc flags OTHER `Record<IndicatorKey>` sites missing `smc`, fix each (report). Confirm `visible.smc` initializes false and `zone` gets no pane index.

- [ ] **Step 7: Lint**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones && yarn lint src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
```

- [ ] **Step 8: Commit**
```bash
git add src/widgets/chart/model/indicatorRegistry.ts src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts
git commit -m "feat(chart): register smc (zone kind, surfaces SMC modal group)"
```

---

## Task 4: `useSmcZones` hook

**Files:**
- Create: `src/widgets/chart/hooks/useSmcZones.ts`
- Test: `src/widgets/chart/__tests__/hooks/useSmcZones.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/widgets/chart/__tests__/hooks/useSmcZones.test.ts`:
```ts
// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { IndicatorResult, SMCResult } from '@y0ngha/siglens-core';
import { useSmcZones } from '../../hooks/useSmcZones';
import { buildSmcZoneLines } from '../../utils/smcZoneUtils';

const mockCreatePriceLine = vi.fn(() => ({ id: 'pl' }));
const mockRemovePriceLine = vi.fn();

vi.mock('lightweight-charts', () => ({
    LineStyle: { Dashed: 2 },
}));

function makeSeriesRef(series: unknown = makeSeries()) {
    return { current: series } as Parameters<
        typeof useSmcZones
    >[0]['seriesRef'];
}
function makeSeries() {
    return {
        createPriceLine: mockCreatePriceLine,
        removePriceLine: mockRemovePriceLine,
    };
}

function smc(overrides: Partial<SMCResult>): SMCResult {
    return {
        swingHighs: [],
        swingLows: [],
        orderBlocks: [],
        fairValueGaps: [],
        equalHighs: [],
        equalLows: [],
        premiumZone: null,
        discountZone: null,
        equilibriumZone: null,
        structureBreaks: [],
        ...overrides,
    };
}

const THREE_ZONES = smc({
    premiumZone: { high: 110, low: 105, type: 'premium' },
    discountZone: { high: 95, low: 90, type: 'discount' },
    equilibriumZone: { high: 101, low: 99, type: 'equilibrium' },
});

describe('useSmcZones', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not create lines when series is null', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(null),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('creates 5 price lines for three zones when visible', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).toHaveBeenCalledTimes(5);
    });

    it('does not create lines when not visible', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: false,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('does not create lines when there are no zones', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: smc({}),
                isVisible: true,
            })
        );
        expect(mockCreatePriceLine).not.toHaveBeenCalled();
    });

    it('removes existing lines when toggled off', () => {
        const series = makeSeries();
        const { rerender } = renderHook(props => useSmcZones(props), {
            initialProps: {
                seriesRef: makeSeriesRef(series),
                smc: THREE_ZONES,
                isVisible: true,
            },
        });
        rerender({
            seriesRef: makeSeriesRef(series),
            smc: THREE_ZONES,
            isVisible: false,
        });
        expect(mockRemovePriceLine).toHaveBeenCalledTimes(5);
    });

    it('passes the first line spec from buildSmcZoneLines to createPriceLine', () => {
        renderHook(() =>
            useSmcZones({
                seriesRef: makeSeriesRef(),
                smc: THREE_ZONES,
                isVisible: true,
            })
        );
        const expected = buildSmcZoneLines(THREE_ZONES)[0];
        expect(mockCreatePriceLine).toHaveBeenCalledWith(
            expect.objectContaining({
                price: expected.price,
                color: expected.color,
                title: expected.title,
            })
        );
    });
});
```
NOTE: this test does NOT mock `../../utils/smcZoneUtils` — it uses the real `buildSmcZoneLines` so the wiring (line specs → createPriceLine args) is verified end-to-end. `IndicatorResult` import is only for typing if needed; remove it if unused to avoid a lint warning.

- [ ] **Step 2: Run to verify it fails**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn vitest run src/widgets/chart/__tests__/hooks/useSmcZones.test.ts` → FAIL.

- [ ] **Step 3: Implement the hook**

Create `src/widgets/chart/hooks/useSmcZones.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type {
    IPriceLine,
    ISeriesApi,
    LineWidth,
    UTCTimestamp,
} from 'lightweight-charts';
import { LineStyle } from 'lightweight-charts';
import type { SMCResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildSmcZoneLines } from '../utils/smcZoneUtils';

interface UseSmcZonesParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    smc: SMCResult | undefined;
    isVisible: boolean;
    lineWidth?: LineWidth;
}

export function useSmcZones({
    seriesRef,
    smc,
    isVisible,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseSmcZonesParams): void {
    const priceLinesRef = useRef<IPriceLine[]>([]);

    useEffect(() => {
        const series = seriesRef.current;

        priceLinesRef.current.forEach(pl => series?.removePriceLine(pl));
        priceLinesRef.current = [];

        if (!series || !isVisible) return;

        const lines = buildSmcZoneLines(smc);
        if (lines.length === 0) return;

        priceLinesRef.current = lines.map(line =>
            series.createPriceLine({
                price: line.price,
                color: line.color,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                // 대표선(title 있음)만 축 라벨 표시 — 밴드 하단선 라벨 중복으로 축 혼잡해지는 것 방지.
                axisLabelVisible: line.title !== '',
                title: line.title,
            })
        );
    }, [smc, isVisible, lineWidth, seriesRef]);
}
```

- [ ] **Step 4: Run + tsc + lint**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
npx tsc --noEmit
yarn vitest run src/widgets/chart/__tests__/hooks/useSmcZones.test.ts
yarn lint src/widgets/chart/hooks/useSmcZones.ts src/widgets/chart/__tests__/hooks/useSmcZones.test.ts
```
Expected: all clean/PASS (6 tests).

- [ ] **Step 5: Commit**
```bash
git add src/widgets/chart/hooks/useSmcZones.ts src/widgets/chart/__tests__/hooks/useSmcZones.test.ts
git commit -m "feat(chart): add useSmcZones hook (price-line bands)"
```

---

## Task 5: Wire into StockChart

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: Import + call the hook**

In `src/widgets/chart/StockChart.tsx`, add the import near other hook imports (after `useActionRecommendationOverlay`):
```ts
import { useSmcZones } from './hooks/useSmcZones';
```
Add the hook call right after the `useActionRecommendationOverlay({...})` call (~line 368):
```ts
    useSmcZones({
        seriesRef,
        smc: indicators.smc,
        isVisible: visible.smc,
    });
```

- [ ] **Step 2: Add the binding (33→34)**

In the `indicatorBindings` useMemo, after the `elderImpulse` binding (last entry), add:
```ts
            {
                meta: INDICATOR_META.smc,
                active: visible.smc,
                onToggle: () => toggle('smc'),
            },
```
`visible`/`toggle` are already in the useMemo deps.

- [ ] **Step 3: tsc + chart suite**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones
npx tsc --noEmit
yarn vitest run src/widgets/chart
```
tsc clean; tests PASS. In `src/widgets/chart/__tests__/StockChart.test.tsx`:
- Update the binding-count test (name + `data-count`) from 33 to 34, append `,smc` to expected `data-keys` (after `elderImpulse`).
- Add `'smc'` to the `INACTIVE_PANES` array.
- Add `smc: false` to the `useIndicatorVisibility` `visible` mock.
- The mock `EMPTY_INDICATOR_RESULT` (or equivalent `indicators` mock) needs a `smc` field that is a valid SMCResult-shaped object (all-null zones) since `useSmcZones` reads `indicators.smc` — if the test's indicators mock lacks `smc`, add a minimal `smc: { swingHighs: [], swingLows: [], orderBlocks: [], fairValueGaps: [], equalHighs: [], equalLows: [], premiumZone: null, discountZone: null, equilibriumZone: null, structureBreaks: [] }`. (If the real `EMPTY_INDICATOR_RESULT` from core is used and already includes `smc`, nothing to add — confirm.)
Report exactly what you changed.

- [ ] **Step 4: Lint**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones && yarn lint src/widgets/chart/StockChart.tsx
```

- [ ] **Step 5: Commit**
```bash
git add src/widgets/chart/StockChart.tsx src/widgets/chart/__tests__/StockChart.test.tsx
git commit -m "feat(chart): wire SMC zones into StockChart (34 bindings)"
```

---

## Task 6: E2E modal toggle

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: Add the toggle test**

SMC zones are price lines (no pane label, no overlay legend) — verify via the modal checkbox state. Add immediately after the LAST existing test in the `test.describe('chart indicator settings modal', ...)` block, before its closing `});` (READ the file to locate it). `GEAR` is the const at the top of the describe.
```ts

    test('toggles SMC Zones via the modal', async ({ page }) => {
        await page.goto('/AAPL');
        await page.getByRole('button', { name: GEAR }).click();
        const dialog = page.getByRole('dialog');
        // SMC Zones는 가격선(zone) — pane/overlay 라벨이 없어 모달 체크박스 상태로 검증한다.
        // 'SMC' 카테고리 그룹이 이 지표 등록으로 처음 모달에 노출된다.
        await expect(dialog.getByText('SMC')).toBeVisible();
        const smc = dialog.getByRole('checkbox', {
            name: 'SMC Zones',
            exact: true,
        });
        await expect(smc).not.toBeChecked();
        await smc.check();
        await expect(smc).toBeChecked();
    });
```

- [ ] **Step 2: Lint + tsc**
```bash
cd /Users/y0ngha/Project/siglens-smc-zones && yarn lint e2e/specs/chart-indicators.spec.ts && npx tsc --noEmit
```
Expected: clean. (Do NOT run Playwright locally — shared docker backend; CI is the gate.)

- [ ] **Step 3: Commit**
```bash
git add e2e/specs/chart-indicators.spec.ts
git commit -m "test(e2e): toggle SMC Zones from settings modal"
```

---

## Task 7: Final verification + review handoff

**Files:** none

- [ ] **Step 1: Full coverage suite**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn test-coverage > /tmp/smc-cov.log 2>&1; echo "EXIT=$?"; tail -8 /tmp/smc-cov.log`
Expected: `EXIT=0`, thresholds (90%+) met.

- [ ] **Step 2: Lint + format (whole repo)**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn lint && npx prettier --check .`
Expected: no errors.

- [ ] **Step 3: Production build (capture exit code directly)**

`cd /Users/y0ngha/Project/siglens-smc-zones && yarn build > /tmp/smc-build.log 2>&1; echo "EXIT=$?"; tail -12 /tmp/smc-build.log`
Expected: `EXIT=0`.

- [ ] **Step 4: Hand off to review**

Per CLAUDE.md routing: invoke `review-agent` (Opus 4.8) on branch `feat/render-smc-zones`, then `mistake-managing-agent`, then `git-agent` to push and open the PR stacked on `feat/render-elder-impulse` (#587). Do not merge before APPROVED.

---

## Self-Review

**Spec coverage:**
- §3.1 buildSmcZoneLines → Task 2. ✓
- §3.2 useSmcZones → Task 4. ✓
- §3.3 colors + @theme → Task 1. ✓
- §3.4 registry (zone kind, smc, 33→34, makePaneIndices, SMC group surfacing) → Task 3. ✓
- §3.5 StockChart wiring → Task 5. ✓
- §5.5 E2E → Task 6. ✓
- §5 test strategy (90%+, happy + worst) → Task 2 (all-null/undefined/partial/midpoint), Task 4 (series-null/not-visible/no-zones/remove-on-off/wiring), Task 3 (group surfacing). ✓

**Placeholder scan:** No TBD/TODO. Task 5 Step 3 instructs confirming/adding the `smc` field to the indicators mock "as flagged" — the exact mock shape depends on whether the test uses core's EMPTY_INDICATOR_RESULT (which includes smc) or a local mock; both fixes are fully specified.

**Type consistency:** `buildSmcZoneLines(smc)` and `SmcZoneLine` consistent across Tasks 2/4. `useSmcZones({ seriesRef, smc, isVisible })` consistent Tasks 4/5. Color keys `smcPremium/Discount/Equilibrium` consistent Tasks 1/2. Registry count 33→34 consistent Tasks 3/5. `zone` kind consistent Tasks 3. ✓
