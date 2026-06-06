# 그룹 A-밴드 (Keltner·Donchian 오버레이) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keltner·Donchian 채널 2종을 가격 차트 오버레이(Pane 0)로 렌더한다. keltner는 부드러운 곡선 3선, donchian은 계단형(WithSteps) 3선 + 점선 middle.

**Architecture:** `useBollingerOverlay`의 overlay 메커니즘(자체 `useState(isVisible)`+toggle, Pane 0에 3시리즈)을 복제한다. keltner/donchian은 bollinger와 동일한 `{upper,middle,lower}` 구조라 `buildSeriesData` 제네릭을 재사용한다. 레지스트리 kind:`'overlay'` 메타 추가 → 모달 자동 노출. `useIndicatorVisibility`(pane 전용)·paneIndex는 무관.

**Tech Stack:** Next.js 16 / React 19 (`'use client'`), lightweight-charts 5.1.0 (AreaSeries·LineSeries·LineType·LineStyle), `@y0ngha/siglens-core`(IndicatorResult), vitest + RTL, Playwright.

**작업 위치:** 워크트리 `/Users/y0ngha/Project/siglens-group-a`, 브랜치 `feat/render-group-a-bands` (base `feat/render-group-c-simple`=#580). 스펙: `docs/superpowers/specs/2026-06-07-render-group-a-bands-design.md`.

**커밋 규칙:** 커밋은 `git-agent`에 위임. `--no-verify` 금지.

---

## File Structure

**신규**
- `src/widgets/chart/hooks/useKeltnerOverlay.ts` + 테스트
- `src/widgets/chart/hooks/useDonchianOverlay.ts` + 테스트

**수정**
- `src/widgets/chart/model/indicatorRegistry.ts` — IndicatorKey +2, INDICATOR_REGISTRY +2 (overlay)
- `src/shared/lib/chartColors.ts` — 8색 (keltner/donchian × upper/middle/lower/background)
- `src/widgets/chart/utils/overlayLabelUtils.ts` — keltnerVisible/donchianVisible params + KC/DC config
- `src/widgets/chart/StockChart.tsx` — 2 훅 호출 + binding 24→26 + overlayLabelConfigs params
- 각 테스트(registry·overlayLabelUtils·StockChart)
- `e2e/specs/chart-indicators.spec.ts`

**불변 (회귀 위험 0)**
- 기존 overlay 훅(bollinger/MA/EMA/ichimoku/VP), pane 훅(13종), `useIndicatorVisibility`, `IndicatorSettingsModal`, `buildSeriesData`

---

## Task 0: 워크트리 node_modules

- [ ] **Step 1**: `cp -al /Users/y0ngha/Project/siglens/node_modules /Users/y0ngha/Project/siglens-group-a/node_modules && rm -rf /Users/y0ngha/Project/siglens-group-a/node_modules/node_modules` (에러 없음)
- [ ] **Step 2**: `cd /Users/y0ngha/Project/siglens-group-a && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts 2>&1 | tail -6` (기존 24 지표 PASS)

---

## Task 1: 레지스트리 2 overlay 메타

**Files:** Modify `src/widgets/chart/model/indicatorRegistry.ts`, `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`

- [ ] **Step 1: 테스트 갱신 (실패 유도)**

count 26으로, overlay 검증 추가:
```ts
it('registers exactly the 26 modal-target indicators', () => {
    expect(INDICATOR_REGISTRY).toHaveLength(26);
});

it('registers keltner/donchian as volatility overlays', () => {
    expect(INDICATOR_META.keltnerChannel).toMatchObject({ category: 'volatility', kind: 'overlay' });
    expect(INDICATOR_META.donchianChannel).toMatchObject({ category: 'volatility', kind: 'overlay' });
});
```
(기존 "registers exactly the 24" → 26.)

- [ ] **Step 2: Run → 실패** `cd /Users/y0ngha/Project/siglens-group-a && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts` (length 24≠26)

- [ ] **Step 3: 구현**

`indicatorRegistry.ts`:
1. `IndicatorKey` union에 `'keltnerChannel' | 'donchianChannel'` 추가.
2. `INDICATOR_REGISTRY` 끝에:
```ts
    { key: 'keltnerChannel', label: 'Keltner', category: 'volatility', kind: 'overlay' },
    { key: 'donchianChannel', label: 'Donchian', category: 'volatility', kind: 'overlay' },
```
(카테고리 union·CATEGORY_LABELS 무변경. 이 두 키는 kind:'overlay'라 useIndicatorVisibility의 pane 필터에서 자동 제외됨.)

> 주의: `makePaneIndices` 헬퍼(paneLabelUtils.test)가 `satisfies PaneIndices`(=Record<IndicatorKey,number>)라 키 2개 추가 시 비충족. `paneLabelUtils.test.ts`의 makePaneIndices base에 `keltnerChannel: INACTIVE_PANE_INDEX, donchianChannel: INACTIVE_PANE_INDEX` 추가(buildPaneLabels는 overlay 키 안 읽으므로 INACTIVE로 무방).

- [ ] **Step 4: Run → 통과** `yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts && npx tsc --noEmit 2>&1 | tail -2`

- [ ] **Step 5: Commit (git-agent)** — `feat(chart): register Keltner/Donchian overlay indicators`

---

## Task 2: 색상 8개 + 중복 검증

**Files:** Modify `src/shared/lib/chartColors.ts`

- [ ] **Step 1: 색 추가**

`CHART_COLORS`에 추가 (섹션 레이블 주석 없이):
```ts
    keltnerUpper: '#5eead4',
    keltnerMiddle: '#14b8a6',
    keltnerLower: '#5eead4',
    keltnerBackground: '#5eead420',
    donchianUpper: '#fcd34d',
    donchianMiddle: '#d97706',
    donchianLower: '#fcd34d',
    donchianBackground: '#fcd34d20',
```
> keltner는 teal 계열(upper/lower 동일 색 + middle 진한 teal), donchian은 amber 계열. bollinger와 동일하게 upper/lower 같은 색 + middle 구분색 패턴.

- [ ] **Step 2: 라인색 중복 검증**

```bash
cd /Users/y0ngha/Project/siglens-group-a
grep -oE "#[0-9a-fA-F]{6}" src/shared/lib/chartColors.ts | sort | uniq -d
```
Expected: keltnerUpper/Lower(#5eead4)·donchianUpper/Lower(#fcd34d)는 의도적 쌍이라 중복으로 나옴 — 이건 허용(bollinger도 upper/lower 동일). 그 외에 **다른 지표 라인색과 겹치는 hex가 나오면** 교체. 확인: `grep -oE "#[0-9a-fA-F]{6}" src/shared/lib/chartColors.ts | sort | uniq -c | sort -rn | head` 로 #5eead4·#fcd34d·#14b8a6·#d97706가 기존 다른 키와 안 겹치는지(각 2회 이하, 신규 keltner/donchian 내부 쌍만) 확인. 겹치면 미사용 hex로 교체.

- [ ] **Step 3: tsc + lint** `npx tsc --noEmit 2>&1 | tail -2; echo TSC=$? && yarn lint 2>&1 | tail -3` (clean)

- [ ] **Step 4: Commit (git-agent)** — `feat(chart): add Keltner/Donchian overlay colors`

---

## Task 3: useKeltnerOverlay 훅 (bollinger 복제)

**Files:** Create `src/widgets/chart/hooks/useKeltnerOverlay.ts`, test

- [ ] **Step 1: 테스트 작성 (실패 유도)**

먼저 `src/widgets/chart/__tests__/hooks/useBollingerOverlay.test.ts`를 읽어 mock 구조(addSeries/removeSeries/setData spy)를 따른다. Create `useKeltnerOverlay.test.ts`를 그 복제로: indicators fixture `{ ...EMPTY, keltnerChannel: [{upper:11,middle:10,lower:9}, ...] }`, 검증 — toggle()로 isVisible true→addSeries 3회(upper/middle/lower), false→removeSeries, 데이터 sync(setData 3회), worst-case(`keltnerChannel: []`→setData 미호출). useBollingerOverlay.test의 케이스를 1:1 키 치환(bollinger→keltnerChannel).

- [ ] **Step 2: Run → 실패** `cd /Users/y0ngha/Project/siglens-group-a && yarn test src/widgets/chart/__tests__/hooks/useKeltnerOverlay.test.ts` (모듈 없음)

- [ ] **Step 3: 구현**

Create `src/widgets/chart/hooks/useKeltnerOverlay.ts` (useBollingerOverlay 복제, 색·키 치환):
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
import { AreaSeries, LineSeries } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildSeriesData } from '../utils/seriesDataUtils';

interface UseKeltnerOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
}

interface UseKeltnerOverlayReturn {
    isVisible: boolean;
    toggle: () => void;
}

export function useKeltnerOverlay({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
}: UseKeltnerOverlayParams): UseKeltnerOverlayReturn {
    const [isVisible, setIsVisible] = useState(false);
    const prevChartRef = useRef<IChartApi | null>(null);
    const upperSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const middleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const lowerSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);

    const toggle = useCallback(() => {
        setIsVisible(prev => !prev);
    }, []);

    // chart 인스턴스 교체 시 ref만 초기화 (removeSeries 불필요 — 이전 chart는 부모가 소멸)
    const clearSeriesRefs = useEffectEvent(() => {
        upperSeriesRef.current = null;
        middleSeriesRef.current = null;
        lowerSeriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (upperSeriesRef.current) {
            chart.removeSeries(upperSeriesRef.current);
            upperSeriesRef.current = null;
        }
        if (middleSeriesRef.current) {
            chart.removeSeries(middleSeriesRef.current);
            middleSeriesRef.current = null;
        }
        if (lowerSeriesRef.current) {
            chart.removeSeries(lowerSeriesRef.current);
            lowerSeriesRef.current = null;
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

        if (!upperSeriesRef.current) {
            upperSeriesRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.keltnerBackground,
                bottomColor: CHART_COLORS.keltnerBackground,
                lineColor: CHART_COLORS.keltnerUpper,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        upperSeriesRef.current.applyOptions({ lineWidth });

        if (!middleSeriesRef.current) {
            middleSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.keltnerMiddle,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        middleSeriesRef.current.applyOptions({ lineWidth });

        if (!lowerSeriesRef.current) {
            lowerSeriesRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.background,
                bottomColor: CHART_COLORS.background,
                lineColor: CHART_COLORS.keltnerLower,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
        }
        lowerSeriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth]);

    useEffect(() => {
        if (!isVisible) return;
        const { keltnerChannel } = indicators;
        if (!keltnerChannel.length) return;
        if (
            !upperSeriesRef.current ||
            !middleSeriesRef.current ||
            !lowerSeriesRef.current
        )
            return;
        upperSeriesRef.current.setData(
            buildSeriesData(bars, keltnerChannel, 'upper')
        );
        middleSeriesRef.current.setData(
            buildSeriesData(bars, keltnerChannel, 'middle')
        );
        lowerSeriesRef.current.setData(
            buildSeriesData(bars, keltnerChannel, 'lower')
        );
    }, [indicators, bars, isVisible]);

    return { isVisible, toggle };
}
```
> `CHART_COLORS.background`는 lower Area의 채움 제거용(bollinger와 동일 — upper만 채우고 lower는 투명). 기존 bollinger 훅 코드와 정확히 일치하는지 확인.

- [ ] **Step 4: Run → 통과** `yarn test src/widgets/chart/__tests__/hooks/useKeltnerOverlay.test.ts`

- [ ] **Step 5: Commit (git-agent)** — `feat(chart): add useKeltnerOverlay (curved 3-band overlay)`

---

## Task 4: useDonchianOverlay 훅 (keltner 복제 + 계단형)

**Files:** Create `src/widgets/chart/hooks/useDonchianOverlay.ts`, test

- [ ] **Step 1: 테스트 작성 (실패 유도)**

`useKeltnerOverlay.test.ts`를 복제해 키만 `donchianChannel`로. 추가로 **WithSteps 검증**: upper/lower `addSeries` 호출 옵션에 `lineType: LineType.WithSteps`, middle에 `lineStyle: LineStyle.Dashed`가 포함됐는지 단언(`expect(mockAddSeries).toHaveBeenCalledWith(AreaSeries, expect.objectContaining({ lineType: ... }))` — lightweight-charts mock의 LineType/LineStyle enum 값에 맞춤). 나머지 케이스(3시리즈 생성/제거/데이터/빈배열)는 keltner와 동일.

- [ ] **Step 2: Run → 실패** `yarn test src/widgets/chart/__tests__/hooks/useDonchianOverlay.test.ts`

- [ ] **Step 3: 구현**

`useKeltnerOverlay.ts`를 복사해 Create `useDonchianOverlay.ts`. 변경점:
- 함수명 `useDonchianOverlay`, 인터페이스명 `UseDonchianOverlay*`.
- import에 `LineType, LineStyle` 추가: `import { AreaSeries, LineSeries, LineType, LineStyle } from 'lightweight-charts';`
- 데이터 accessor: `indicators.donchianChannel`.
- 색: `donchianUpper/donchianMiddle/donchianLower/donchianBackground`.
- **upper(Area) addSeries 옵션에 `lineType: LineType.WithSteps` 추가**:
```ts
            upperSeriesRef.current = chart.addSeries(AreaSeries, {
                topColor: CHART_COLORS.donchianBackground,
                bottomColor: CHART_COLORS.donchianBackground,
                lineColor: CHART_COLORS.donchianUpper,
                lineType: LineType.WithSteps,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
```
- **middle(Line) 옵션에 `lineType: LineType.WithSteps` + `lineStyle: LineStyle.Dashed`**:
```ts
            middleSeriesRef.current = chart.addSeries(LineSeries, {
                color: CHART_COLORS.donchianMiddle,
                lineType: LineType.WithSteps,
                lineStyle: LineStyle.Dashed,
                lineWidth,
                priceLineVisible: false,
                lastValueVisible: false,
            });
```
- **lower(Area) 옵션에 `lineType: LineType.WithSteps`** (topColor/bottomColor=background, lineColor=donchianLower).
- 데이터 sync effect는 `buildSeriesData(bars, donchianChannel, 'upper'|'middle'|'lower')`.

- [ ] **Step 4: Run → 통과** `yarn test src/widgets/chart/__tests__/hooks/useDonchianOverlay.test.ts && npx tsc --noEmit 2>&1 | tail -2`

- [ ] **Step 5: Commit (git-agent)** — `feat(chart): add useDonchianOverlay (stepped 3-band overlay)`

---

## Task 5: overlayLabelUtils — KC/DC legend

**Files:** Modify `src/widgets/chart/utils/overlayLabelUtils.ts`, test

- [ ] **Step 1: 테스트 추가 (실패 유도)**

`overlayLabelUtils.test.ts`(있으면)에, 없으면 생성, 검증:
```ts
it('builds Keltner/Donchian legend configs when visible', () => {
    const configs = buildOverlayLabelConfigs({
        maVisiblePeriods: [], emaVisiblePeriods: [],
        bollingerVisible: false, ichimokuVisible: false, vpVisible: false,
        keltnerVisible: true, donchianVisible: true,
    });
    const names = configs.map(c => c.name);
    expect(names).toEqual(expect.arrayContaining([
        'KC Upper', 'KC Middle', 'KC Lower', 'DC Upper', 'DC Middle', 'DC Lower',
    ]));
    const ind = { keltnerChannel: [{ upper: 11, middle: 10, lower: 9 }], donchianChannel: [{ upper: 21, middle: 20, lower: 19 }] } as unknown as Parameters<typeof configs[0]['getValue']>[0];
    const kcUpper = configs.find(c => c.name === 'KC Upper');
    expect(kcUpper?.getValue(ind, 0)).toBe(11);
});
```
> 기존 테스트가 params 5개를 넘기면 keltnerVisible/donchianVisible 누락으로 타입 에러 → Step 3 후 그 테스트들도 두 flag(false) 추가 갱신 필요.

- [ ] **Step 2: Run → 실패** `yarn test src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts`

- [ ] **Step 3: 구현**

`overlayLabelUtils.ts`:
1. `BuildOverlayLabelConfigsParams`에 `keltnerVisible: boolean; donchianVisible: boolean;` 추가.
2. 함수 destructure에 `keltnerVisible, donchianVisible` 추가.
3. bollingerConfigs 패턴 따라 추가:
```ts
    const keltnerConfigs: OverlayLabelConfig[] = keltnerVisible
        ? [
              { name: 'KC Upper', color: CHART_COLORS.keltnerUpper, getValue: (ind, i) => ind.keltnerChannel[i]?.upper ?? null },
              { name: 'KC Middle', color: CHART_COLORS.keltnerMiddle, getValue: (ind, i) => ind.keltnerChannel[i]?.middle ?? null },
              { name: 'KC Lower', color: CHART_COLORS.keltnerLower, getValue: (ind, i) => ind.keltnerChannel[i]?.lower ?? null },
          ]
        : [];
    const donchianConfigs: OverlayLabelConfig[] = donchianVisible
        ? [
              { name: 'DC Upper', color: CHART_COLORS.donchianUpper, getValue: (ind, i) => ind.donchianChannel[i]?.upper ?? null },
              { name: 'DC Middle', color: CHART_COLORS.donchianMiddle, getValue: (ind, i) => ind.donchianChannel[i]?.middle ?? null },
              { name: 'DC Lower', color: CHART_COLORS.donchianLower, getValue: (ind, i) => ind.donchianChannel[i]?.lower ?? null },
          ]
        : [];
```
(타입 주석은 파일의 기존 `(ind: IndicatorResult, i: number): number | null` 형태에 맞춤.)
4. return 배열에 `...keltnerConfigs, ...donchianConfigs` 추가.

- [ ] **Step 4: 기존 테스트 params 갱신** — overlayLabelUtils.test의 기존 buildOverlayLabelConfigs 호출에 `keltnerVisible: false, donchianVisible: false` 추가(타입 충족).

- [ ] **Step 5: Run → 통과** `yarn test src/widgets/chart/__tests__/utils/overlayLabelUtils.test.ts && npx tsc --noEmit 2>&1 | tail -2`

- [ ] **Step 6: Commit (git-agent)** — `feat(chart): add Keltner/Donchian overlay legend configs`

---

## Task 6: StockChart 통합 (2 훅 + binding 24→26 + legend params)

**Files:** Modify `src/widgets/chart/StockChart.tsx`, `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: StockChart.test data-count·keys 갱신 (실패 유도)**

`data-count` → 26: `expect(modal).toHaveAttribute('data-count', '26');`
`data-keys` 순서 단언 있으면 끝에 `,keltnerChannel,donchianChannel` 추가.
StockChart.test가 overlay 훅을 mock하는 방식 확인 — bollinger 훅 mock 패턴 따라 useKeltnerOverlay/useDonchianOverlay mock 추가(`() => ({ isVisible: false, toggle: vi.fn() })`).

- [ ] **Step 2: Run → 실패** `yarn test src/widgets/chart/__tests__/StockChart.test.tsx` (data-count 24≠26)

- [ ] **Step 3: StockChart import + 훅 호출**

import 추가:
```ts
import { useKeltnerOverlay } from './hooks/useKeltnerOverlay';
import { useDonchianOverlay } from './hooks/useDonchianOverlay';
```
bollinger 훅 호출(L194 근처) 뒤에:
```ts
const { isVisible: keltnerVisible, toggle: toggleKeltner } =
    useKeltnerOverlay(commonHookParams);
const { isVisible: donchianVisible, toggle: toggleDonchian } =
    useDonchianOverlay(commonHookParams);
```

- [ ] **Step 4: overlayLabelConfigs params + deps**

`buildOverlayLabelConfigs({...})` 호출에 `keltnerVisible, donchianVisible` 추가, useMemo deps에도 `keltnerVisible, donchianVisible` 추가.

- [ ] **Step 5: binding 2개 추가 (24→26)**

`indicatorBindings`에 추가:
```ts
{ meta: INDICATOR_META.keltnerChannel, active: keltnerVisible, onToggle: toggleKeltner },
{ meta: INDICATOR_META.donchianChannel, active: donchianVisible, onToggle: toggleDonchian },
```
binding useMemo deps에 `keltnerVisible, donchianVisible, toggleKeltner, toggleDonchian` 추가(bollingerVisible/toggleBollinger가 개별로 들어가 있는 패턴 따름).

- [ ] **Step 6: Run → 통과 + 전체 차트** `yarn test src/widgets/chart/__tests__/StockChart.test.tsx && npx tsc --noEmit 2>&1 | tail -2 && yarn test src/widgets/chart 2>&1 | tail -5`
Expected: data-count=26, tsc 0, 전체 PASS.

- [ ] **Step 7: Commit (git-agent)** — `feat(chart): wire Keltner/Donchian overlays into StockChart`

---

## Task 7: E2E

**Files:** Modify `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: 시나리오 추가**

overlay는 pane label(`.pane-indicator-label`)이 아니라 OverlayLegend로 표시된다. 기존 spec에서 overlay(bollinger 등) 검증 패턴이 있으면 따르고, 없으면 모달 체크 상태 + OverlayLegend 텍스트로 검증:
```ts
test('toggles Keltner channel overlay via the modal', async ({ page }) => {
    await page.goto('/AAPL');
    await page.getByRole('button', { name: GEAR }).click();
    const dialog = page.getByRole('dialog');
    const kc = dialog.getByRole('checkbox', { name: 'Keltner', exact: true });
    await kc.check();
    await expect(kc).toBeChecked();
});
```
> overlay 차트 반영을 안정적으로 검증하기 어려우면(crosshair 필요) 모달 체크 상태로 검증. OverlayLegend 텍스트(`KC Upper` 등)는 crosshair hover 시에만 나오므로 E2E에선 모달 토글 검증이 안정적.

- [ ] **Step 2: --list 확인** `cd /Users/y0ngha/Project/siglens-group-a && npx playwright test e2e/specs/chart-indicators.spec.ts --list 2>&1 | tail -10`

- [ ] **Step 3: Commit (git-agent)** — `test(e2e): cover Keltner overlay toggle`

---

## Task 8: 최종 검증

- [ ] **Step 1: Lint** `cd /Users/y0ngha/Project/siglens-group-a && yarn lint 2>&1 | tail -5`
- [ ] **Step 2: 신규 2훅 커버리지 90%+**
```bash
npx vitest run --coverage \
  --coverage.include='src/widgets/chart/hooks/useKeltnerOverlay.ts' \
  --coverage.include='src/widgets/chart/hooks/useDonchianOverlay.ts' \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 \
  src/widgets/chart/__tests__ 2>&1 | grep -E "All files|Stmts|----" | head
```
Expected: 90%+ (미달 시 worst-case 보강).
- [ ] **Step 3: 전체 유닛** `yarn test 2>&1 | tail -12` (전부 PASS)
- [ ] **Step 4: 빌드** `yarn build > /tmp/groupa-build.log 2>&1; echo "EXIT=$?"` (EXIT=0)
- [ ] **Step 5: review-agent 라우팅** — CLAUDE.md 워크플로우(review-agent Opus 4.8 → mistake-managing → git-agent push/PR).

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: §2(자료조사 렌더)=Task 3·4, §5.1(2훅)=Task 3·4, §5.2(레지스트리)=Task 1, §5.3(색)=Task 2, §5.4(legend)=Task 5, §5.5(StockChart)=Task 6, §7(테스트)=각 Task+8. 전부 매핑.
- **Placeholder**: 없음. useKeltnerOverlay 풀코드 + useDonchianOverlay 정확한 치환점(WithSteps/Dashed 3시리즈). 색은 후보 hex + Task 2 중복 검증 단계.
- **타입 일관성**: `keltnerChannel`/`donchianChannel` 키, `CHART_COLORS.keltner*`/`donchian*`, `keltnerVisible`/`toggleKeltner`, binding `INDICATOR_META.keltnerChannel` — Task 1·2·3·4 정의와 Task 5·6 사용처 일치.
- **순서 의존**: 1(레지스트리)→2(색)→3(keltner 훅)→4(donchian 훅, keltner 복제)→5(legend)→6(StockChart)→7(E2E). makePaneIndices fallout은 Task 1에서 처리.
- **회귀**: 기존 overlay/pane 훅·useIndicatorVisibility·모달 무변경. StockChart binding 24→26 + overlayLabelConfigs params 확장으로 기존 테스트(data-count) 갱신.
