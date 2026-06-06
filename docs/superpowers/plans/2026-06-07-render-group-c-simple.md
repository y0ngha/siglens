# 그룹 C-단순 (unbounded 단일-라인 pane 6종) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** unbounded 단일-라인 보조지표 6종(atr·obv·macdV·forceIndex·yangZhang·ewmaVolatility)을 차트 pane으로 렌더한다. macdV·forceIndex는 0 기준선, 나머지 4종은 기준선 없음.

**Architecture:** group-B(PR #577)의 pane 훅 패턴·레지스트리·paneIndex 일반화 인프라를 그대로 재사용한다. 6개 신규 pane 훅은 `useRSIChart`/group-B 훅을 복제하고, 레지스트리에 6 메타를 추가하면 `useIndicatorVisibility`(레지스트리 기반)·`IndicatorSettingsModal`이 자동으로 새 pane을 배정·노출한다. 기존 13개 pane 훅·visibility·모달은 무변경.

**Tech Stack:** Next.js 16 / React 19 (`'use client'`), lightweight-charts 5.1.0, `@y0ngha/siglens-core`(IndicatorResult), vitest + RTL, Playwright.

**작업 위치:** 워크트리 `/Users/y0ngha/Project/siglens-group-c`, 브랜치 `feat/render-group-c-simple` (base `feat/render-unused-indicators`=#577). 스펙: `docs/superpowers/specs/2026-06-07-render-group-c-simple-design.md`.

**커밋 규칙:** 커밋은 `git-agent`에 위임(CLAUDE.md). 각 Task 끝 commit은 git-agent로. `--no-verify` 금지.

---

## File Structure

**신규**
- `src/widgets/chart/hooks/useMacdVChart.ts` 외 5개(`useForceIndexChart`·`useObvChart`·`useAtrChart`·`useYangZhangChart`·`useEwmaVolatilityChart`) + 각 colocated 테스트

**수정**
- `src/widgets/chart/model/indicatorRegistry.ts` — `IndicatorKey` +6, `INDICATOR_REGISTRY` +6 (카테고리 union 무변경)
- `src/widgets/chart/constants/indicatorLevels.ts` — `MACD_V_ZERO_LEVEL`·`FORCE_INDEX_ZERO_LEVEL`
- `src/shared/lib/chartColors.ts` — 6 라인색 + zero선 색
- `src/widgets/chart/utils/paneLabelUtils.ts` — 6 pane label
- `src/widgets/chart/StockChart.tsx` — 6 훅 호출 + binding 18→24
- `src/widgets/chart/__tests__/StockChart.test.tsx` — data-count 18→24, data-keys +6
- 각 테스트 파일(레지스트리·상수·paneLabel)
- `e2e/specs/chart-indicators.spec.ts`

**불변 (회귀 위험 0)**
- 기존 13개 pane 훅(useRSIChart~useCCIChart, group-B 7종), `useIndicatorVisibility`, `IndicatorSettingsModal`, `buildSinglePaneLabel`, `buildSeriesDataFromValues`

---

## Task 0: 워크트리 node_modules 준비

- [ ] **Step 1: 하드링크 복제**

Run:
```bash
cp -al /Users/y0ngha/Project/siglens/node_modules /Users/y0ngha/Project/siglens-group-c/node_modules
rm -rf /Users/y0ngha/Project/siglens-group-c/node_modules/node_modules
```
Expected: 에러 없음.

- [ ] **Step 2: 러너 확인**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts 2>&1 | tail -6`
Expected: 기존 레지스트리 테스트 PASS (현재 18 지표).

---

## Task 1: 레지스트리 6 메타 추가

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`

- [ ] **Step 1: 테스트 갱신 (실패 유도)**

`indicatorRegistry.test.ts`에서 등록 수를 24로, 그룹 C 카테고리 검증 추가:
```ts
it('registers exactly the 24 modal-target indicators', () => {
    expect(INDICATOR_REGISTRY).toHaveLength(24);
});

it('places group-C-simple indicators in the right categories', () => {
    const byKey = Object.fromEntries(
        INDICATOR_REGISTRY.map(m => [m.key, m.category])
    );
    expect(byKey.macdV).toBe('momentum');
    expect(byKey.forceIndex).toBe('momentum');
    expect(byKey.obv).toBe('volume');
    expect(byKey.atr).toBe('volatility');
    expect(byKey.yangZhang).toBe('volatility');
    expect(byKey.ewmaVolatility).toBe('volatility');
});

it('all group-C-simple indicators are pane kind', () => {
    const groupC = ['macdV', 'forceIndex', 'obv', 'atr', 'yangZhang', 'ewmaVolatility'];
    expect(
        groupC.every(key => INDICATOR_META[key as IndicatorKey].kind === 'pane')
    ).toBe(true);
});
```
> 기존 "registers exactly the N" 테스트가 18이면 24로 변경. `type IndicatorKey`는 이미 import됨.

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL (length 18≠24).

- [ ] **Step 3: 레지스트리 구현**

`indicatorRegistry.ts`:
1. `IndicatorKey` union에 6키 추가:
```ts
    | 'macdV' | 'forceIndex' | 'obv' | 'atr' | 'yangZhang' | 'ewmaVolatility';
```
(기존 union 끝에 이어서. 멤버만 정확하면 됨.)
2. `INDICATOR_REGISTRY` 끝에 6 메타 추가:
```ts
    { key: 'macdV', label: 'MACD-V', category: 'momentum', kind: 'pane' },
    { key: 'forceIndex', label: 'Force Index', category: 'momentum', kind: 'pane' },
    { key: 'obv', label: 'OBV', category: 'volume', kind: 'pane' },
    { key: 'atr', label: 'ATR', category: 'volatility', kind: 'pane' },
    { key: 'yangZhang', label: 'Yang-Zhang', category: 'volatility', kind: 'pane' },
    { key: 'ewmaVolatility', label: 'EWMA Vol', category: 'volatility', kind: 'pane' },
```
(`IndicatorCategory`·`CATEGORY_LABELS` 무변경 — 전부 기존 카테고리.)

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts && npx tsc --noEmit 2>&1 | tail -2`
Expected: PASS, tsc 0 errors.

- [ ] **Step 5: Commit (git-agent)** — `feat(chart): register group-C-simple indicators`

---

## Task 2: 0선 상수 + 색상

**Files:**
- Modify: `src/widgets/chart/constants/indicatorLevels.ts`
- Modify: `src/widgets/chart/__tests__/constants/indicatorLevels.test.ts`
- Modify: `src/shared/lib/chartColors.ts`

- [ ] **Step 1: 상수 테스트 추가 (실패 유도)**

`indicatorLevels.test.ts`에 추가:
```ts
it('group-C zero levels', () => {
    expect(MACD_V_ZERO_LEVEL).toBe(0);
    expect(FORCE_INDEX_ZERO_LEVEL).toBe(0);
});
```
그리고 import 라인에 `MACD_V_ZERO_LEVEL, FORCE_INDEX_ZERO_LEVEL` 추가.

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/constants/indicatorLevels.test.ts`
Expected: FAIL (상수 없음).

- [ ] **Step 3: 상수 구현**

`indicatorLevels.ts` 끝에 추가:
```ts
// MACD-V: 0선 교차가 강세/약세 기준 (volatility-normalized MACD, 부호 있음).
export const MACD_V_ZERO_LEVEL = 0;

// Force Index: 0선 교차가 매수/매도 압력 전환 기준.
export const FORCE_INDEX_ZERO_LEVEL = 0;
```

- [ ] **Step 4: 색상 추가 + 중복 검증**

`src/shared/lib/chartColors.ts`의 `CHART_COLORS`에 추가 (group-C 그룹 주석 없이 — #577 리뷰에서 섹션 레이블 주석이 지적됐으므로 단순 키만 추가):
```ts
    macdVLine: '#2dd4bf',
    macdVZero: '#94a3b860',
    forceIndexLine: '#fb7185',
    forceIndexZero: '#94a3b860',
    obvLine: '#7dd3fc',
    atrLine: '#fdba74',
    yangZhangLine: '#d8b4fe',
    ewmaVolatilityLine: '#6ee7b7',
```
> 6 라인색(#2dd4bf·#fb7185·#7dd3fc·#fdba74·#d8b4fe·#6ee7b7)은 기존 팔레트 미사용으로 확인됨. zero선은 회색 #94a3b860 공유(reference선이라 라인색 중복 규칙 무관).

- [ ] **Step 5: 라인색 중복 없음 검증**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-c && grep -oE "Line: '#[0-9a-f]{6}'" src/shared/lib/chartColors.ts | sort | uniq -d
```
Expected: 출력 없음(라인색 전부 유니크). 중복이 나오면 해당 group-C 색을 다른 미사용 hex로 교체.

- [ ] **Step 6: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/constants/indicatorLevels.test.ts && npx tsc --noEmit 2>&1 | tail -2`
Expected: PASS, tsc 0.

- [ ] **Step 7: Commit (git-agent)** — `feat(chart): add group-C-simple levels and colors`

---

## Task 3: 6 pane 훅 (RSI/group-B 복제)

**Files:**
- Create: `src/widgets/chart/hooks/useMacdVChart.ts` 외 5개
- Test: 각 `src/widgets/chart/__tests__/hooks/use<Name>Chart.test.ts`

대표로 `useMacdVChart`(0선 1개) 전체를 제시. 나머지 5개는 치환 명세.

- [ ] **Step 1: useMacdVChart 테스트 작성 (실패 유도)**

먼저 group-B의 `useMfiChart.test.ts`를 읽어 mock 구조를 그대로 따른다. Create `src/widgets/chart/__tests__/hooks/useMacdVChart.test.ts`를 그 패턴으로 작성: indicators fixture `{ ...EMPTY, macdV: [-1, 0.5, 2] }`, 검증 — isVisible true→addSeries 호출, false→removeSeries, paneIndex 변경→재생성, 데이터 sync(setData가 macdV로 호출), **worst-case**(`macdV: []`→setData 미호출). useMfiChart.test.ts의 케이스를 1:1 대응해 키만 macdV로 치환.

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/hooks/useMacdVChart.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: useMacdVChart 구현**

Create `src/widgets/chart/hooks/useMacdVChart.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import type { Bar, IndicatorResult } from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { MACD_V_ZERO_LEVEL } from '../constants/indicatorLevels';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseMacdVChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useMacdVChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseMacdVChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    // 이전 chart는 부모가 소멸시키므로 removeSeries 없이 ref만 초기화하면 충분.
    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
        }
    });

    // 데이터 세팅은 아래 effect에서 단독 처리하므로 이 effect는 lifecycle(생성·제거)만 담당.
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
        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            seriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.macdVLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
            seriesRef.current.createPriceLine({
                price: MACD_V_ZERO_LEVEL,
                color: CHART_COLORS.macdVZero,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
        }
        seriesRef.current.applyOptions({ lineWidth });
    }, [chartRef, isVisible, lineWidth, paneIndex]);

    useEffect(() => {
        if (!isVisible) return;
        const { macdV } = indicators;
        if (!macdV.length) return;
        if (!seriesRef.current) return;
        seriesRef.current.setData(buildSeriesDataFromValues(bars, macdV));
    }, [indicators, bars, isVisible, paneIndex]);
}
```

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/hooks/useMacdVChart.test.ts`
Expected: PASS.

- [ ] **Step 5: 나머지 5개 훅 + 테스트 (useMacdVChart 복제 + 치환)**

각 훅은 useMacdVChart.ts를 복사해 치환. 각 훅마다 대응 테스트(useMacdVChart.test 복제, 키·fixture 치환)도 작성. 데이터 accessor는 모두 `const { <key> } = indicators;` + `buildSeriesDataFromValues(bars, <key>)`.

| 파일 | 함수 | key (accessor) | 라인색 | 기준선 (createPriceLine) |
|---|---|---|---|---|
| `useForceIndexChart.ts` | `useForceIndexChart` | `forceIndex` | `forceIndexLine` | 1개: `FORCE_INDEX_ZERO_LEVEL`(색 `forceIndexZero`), import from `../constants/indicatorLevels` |
| `useObvChart.ts` | `useObvChart` | `obv` | `obvLine` | **없음** (createPriceLine 블록 전체 제거) |
| `useAtrChart.ts` | `useAtrChart` | `atr` | `atrLine` | **없음** |
| `useYangZhangChart.ts` | `useYangZhangChart` | `yangZhang` | `yangZhangLine` | **없음** |
| `useEwmaVolatilityChart.ts` | `useEwmaVolatilityChart` | `ewmaVolatility` | `ewmaVolatilityLine` | **없음** |

**기준선 없는 4종**(obv/atr/yangZhang/ewmaVolatility): `if (!seriesRef.current) { ... addSeries ... }` 안의 `createPriceLine(...)` 호출을 통째로 제거하고 `addSeries` + `applyOptions`만 남긴다. import에서 `LineStyle`·indicatorLevels 상수 불필요 → 제거(LineStyle은 createPriceLine에서만 쓰임).

`useForceIndexChart`만 useMacdVChart와 동일하게 0선 1개(`FORCE_INDEX_ZERO_LEVEL`/`forceIndexZero`, `LineStyle.Dashed` 유지).

> 테스트도 기준선 없는 4종은 "createPriceLine 호출 안 함"을 검증할 필요는 없다(addSeries만 확인). macdV/forceIndex 테스트는 group-B의 priceLine 검증 방식이 있으면 따르고, 없으면 addSeries 호출 검증으로 충분.

- [ ] **Step 6: Run → 6개 훅 테스트 전부 통과**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/hooks/ 2>&1 | tail -8`
Expected: 6 신규 + 기존 훅 테스트 PASS.

- [ ] **Step 7: Commit (git-agent)** — `feat(chart): add 6 group-C-simple pane hooks`

---

## Task 4: paneLabel 6종

**Files:**
- Modify: `src/widgets/chart/utils/paneLabelUtils.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`

- [ ] **Step 1: 테스트 추가 (실패 유도)**

`paneLabelUtils.test.ts`에 group-C label 검증 추가(기존 `makePaneIndices` 헬퍼 + `buildSinglePaneLabel` 검증 패턴 따름):
```ts
it('builds single-subLabel labels for each group-C-simple pane', () => {
    const cases: Array<[keyof PaneIndices, string, string]> = [
        ['macdV', 'MACD-V', CHART_COLORS.macdVLine],
        ['forceIndex', 'Force Index', CHART_COLORS.forceIndexLine],
        ['obv', 'OBV', CHART_COLORS.obvLine],
        ['atr', 'ATR', CHART_COLORS.atrLine],
        ['yangZhang', 'Yang-Zhang', CHART_COLORS.yangZhangLine],
        ['ewmaVolatility', 'EWMA Vol', CHART_COLORS.ewmaVolatilityLine],
    ];
    for (const [key, name, color] of cases) {
        const labels = buildPaneLabels(makePaneIndices({ [key]: 1 }));
        expect(labels).toHaveLength(1);
        expect(labels[0].subLabels).toEqual([{ name, color }]);
    }
});
```
> 파일의 실제 `makePaneIndices` 시그니처·label/color 단언 형태에 맞춘다(group-B 테스트와 동일 방식). `CHART_COLORS` import가 없으면 추가.

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`
Expected: FAIL (group-C label 없음).

- [ ] **Step 3: buildPaneLabels에 6 label 추가**

`paneLabelUtils.ts`의 `buildPaneLabels`에서 기존 `buildSinglePaneLabel` 호출 패턴을 따라 6종 추가:
```ts
const macdVLabel = buildSinglePaneLabel(paneIndices.macdV, 'MACD-V', CHART_COLORS.macdVLine);
const forceIndexLabel = buildSinglePaneLabel(paneIndices.forceIndex, 'Force Index', CHART_COLORS.forceIndexLine);
const obvLabel = buildSinglePaneLabel(paneIndices.obv, 'OBV', CHART_COLORS.obvLine);
const atrLabel = buildSinglePaneLabel(paneIndices.atr, 'ATR', CHART_COLORS.atrLine);
const yangZhangLabel = buildSinglePaneLabel(paneIndices.yangZhang, 'Yang-Zhang', CHART_COLORS.yangZhangLine);
const ewmaVolatilityLabel = buildSinglePaneLabel(paneIndices.ewmaVolatility, 'EWMA Vol', CHART_COLORS.ewmaVolatilityLine);
```
그리고 return 배열 spread에 6개 추가(기존 마지막 뒤):
```ts
    ...macdVLabel, ...forceIndexLabel, ...obvLabel, ...atrLabel, ...yangZhangLabel, ...ewmaVolatilityLabel,
```

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (git-agent)** — `feat(chart): add pane labels for group-C-simple`

---

## Task 5: StockChart 6 훅 호출 + binding 18→24

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: StockChart.test data-count·keys 갱신 (실패 유도)**

`StockChart.test.tsx`의 `data-count` 단언을 24로:
```ts
expect(modal).toHaveAttribute('data-count', '24');
```
`data-keys` 순서 단언이 있으면 기존 18키 뒤에 `,macdV,forceIndex,obv,atr,yangZhang,ewmaVolatility` 추가. mock의 visible/paneIndices 객체에 신규 6키가 빠져있으면 추가(이미 18키 mock이면 6키 추가, 값 false/-1).

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/StockChart.test.tsx`
Expected: FAIL (data-count 18≠24).

- [ ] **Step 3: StockChart import + 6 훅 호출**

import 추가:
```ts
import { useMacdVChart } from './hooks/useMacdVChart';
import { useForceIndexChart } from './hooks/useForceIndexChart';
import { useObvChart } from './hooks/useObvChart';
import { useAtrChart } from './hooks/useAtrChart';
import { useYangZhangChart } from './hooks/useYangZhangChart';
import { useEwmaVolatilityChart } from './hooks/useEwmaVolatilityChart';
```
기존 pane 훅 호출 뒤에 6개 추가:
```ts
useMacdVChart({ ...commonHookParams, isVisible: visible.macdV, paneIndex: paneIndices.macdV });
useForceIndexChart({ ...commonHookParams, isVisible: visible.forceIndex, paneIndex: paneIndices.forceIndex });
useObvChart({ ...commonHookParams, isVisible: visible.obv, paneIndex: paneIndices.obv });
useAtrChart({ ...commonHookParams, isVisible: visible.atr, paneIndex: paneIndices.atr });
useYangZhangChart({ ...commonHookParams, isVisible: visible.yangZhang, paneIndex: paneIndices.yangZhang });
useEwmaVolatilityChart({ ...commonHookParams, isVisible: visible.ewmaVolatility, paneIndex: paneIndices.ewmaVolatility });
```
(기존 6개 호출과 동일 shape.)

- [ ] **Step 4: indicatorBindings에 6 binding 추가**

`indicatorBindings` 배열 끝에 추가:
```ts
{ meta: INDICATOR_META.macdV, active: visible.macdV, onToggle: () => toggle('macdV') },
{ meta: INDICATOR_META.forceIndex, active: visible.forceIndex, onToggle: () => toggle('forceIndex') },
{ meta: INDICATOR_META.obv, active: visible.obv, onToggle: () => toggle('obv') },
{ meta: INDICATOR_META.atr, active: visible.atr, onToggle: () => toggle('atr') },
{ meta: INDICATOR_META.yangZhang, active: visible.yangZhang, onToggle: () => toggle('yangZhang') },
{ meta: INDICATOR_META.ewmaVolatility, active: visible.ewmaVolatility, onToggle: () => toggle('ewmaVolatility') },
```
useMemo deps는 `visible`·`toggle`가 이미 포함되어 있으므로 무변경(확인).

- [ ] **Step 5: Run → 통과 + tsc + 전체 차트**

Run: `cd /Users/y0ngha/Project/siglens-group-c && yarn test src/widgets/chart/__tests__/StockChart.test.tsx && npx tsc --noEmit 2>&1 | tail -2 && yarn test src/widgets/chart 2>&1 | tail -5`
Expected: data-count=24 PASS, tsc 0, 전체 차트 PASS.

- [ ] **Step 6: Commit (git-agent)** — `feat(chart): wire group-C-simple hooks and bindings into StockChart`

---

## Task 6: E2E

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: E2E 시나리오 추가**

기존 describe 블록에 추가(셀렉터는 #577 패턴 — `.pane-indicator-label` 스코프, exact 체크박스):
```ts
test('toggles ATR into a pane via the modal', async ({ page }) => {
    await page.goto('/AAPL');
    await page.getByRole('button', { name: '보조지표 설정' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: 'ATR', exact: true }).check();
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(
        page.locator('.pane-indicator-label').filter({ hasText: 'ATR' })
    ).toBeVisible();
});
```
> `GEAR` 상수가 파일에 있으면 사용. ATR은 volatility 카테고리 체크박스.

- [ ] **Step 2: --list 로드 확인**

Run: `cd /Users/y0ngha/Project/siglens-group-c && npx playwright test e2e/specs/chart-indicators.spec.ts --list 2>&1 | tail -10`
Expected: 신규 테스트 포함 로드, 에러 없음.

- [ ] **Step 3: Commit (git-agent)** — `test(e2e): cover ATR pane toggle`

> 풀 E2E는 pre-push/CI 담당.

---

## Task 7: 최종 검증

- [ ] **Step 1: Lint** — `cd /Users/y0ngha/Project/siglens-group-c && yarn lint 2>&1 | tail -5` (에러 0)

- [ ] **Step 2: 변경 영역 커버리지 90%+**

Run:
```bash
cd /Users/y0ngha/Project/siglens-group-c && npx vitest run --coverage \
  --coverage.include='src/widgets/chart/hooks/useMacdVChart.ts' \
  --coverage.include='src/widgets/chart/hooks/useForceIndexChart.ts' \
  --coverage.include='src/widgets/chart/hooks/useObvChart.ts' \
  --coverage.include='src/widgets/chart/hooks/useAtrChart.ts' \
  --coverage.include='src/widgets/chart/hooks/useYangZhangChart.ts' \
  --coverage.include='src/widgets/chart/hooks/useEwmaVolatilityChart.ts' \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 \
  src/widgets/chart/__tests__ 2>&1 | grep -E "All files|Stmts|----" | head
```
Expected: 신규 6 훅 90%+ (미달 시 worst-case 보강).

- [ ] **Step 3: 전체 유닛 테스트** — `cd /Users/y0ngha/Project/siglens-group-c && yarn test 2>&1 | tail -12` (전부 PASS, 회귀 없음)

- [ ] **Step 4: 빌드 (exit code 직접 캡처)** — `cd /Users/y0ngha/Project/siglens-group-c && yarn build > /tmp/groupc-build.log 2>&1; echo "EXIT=$?"` (EXIT=0)

- [ ] **Step 5: review-agent 라우팅** — 메인 오케스트레이터가 `review-agent`(Opus 4.8) 호출 → findings 반영 → mistake-managing-agent → git-agent(push/PR). CLAUDE.md 워크플로우.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: §4(데이터/카테고리/기준선)=Task 1+2+3, §5.1(6훅)=Task 3, §5.2(레지스트리)=Task 1, §5.3(상수/색)=Task 2, §5.4(label/StockChart)=Task 4+5, §7(테스트)=각 Task+Task 7. 전부 매핑.
- **Placeholder**: 없음. 대표 훅(useMacdVChart) 풀코드 + 나머지 5개 구체 치환표(key/색/기준선 전부 명시). 색은 미사용 검증된 hex + Task 2 Step 5에 중복 검증 단계.
- **타입 일관성**: `IndicatorKey` 24키·`INDICATOR_META.<key>`·`visible.<key>`·`paneIndices.<key>`·`CHART_COLORS.<key>Line` 명칭이 Task 1·2 정의와 Task 3·4·5 사용처 일치.
- **순서 의존**: Task 1(레지스트리)→2(상수/색)→3(훅, 1·2 의존)→4(label, 2 의존)→5(StockChart, 3 의존)→6(E2E). paneIndex 일반화·모달은 #577 완료라 무변경.
- **회귀**: 기존 13 pane 훅·visibility·모달 불변. StockChart binding 추가로 인한 기존 테스트 mock(data-count 18→24) 갱신만.
