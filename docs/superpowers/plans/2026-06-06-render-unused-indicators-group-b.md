# 미사용 보조지표 렌더링 (1차: paneIndex 일반화 + 그룹 B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `useIndicatorVisibility`를 레지스트리 기반으로 일반화하고, bounded 오실레이터 7종(mfi·williamsR·connorsRsi·cmf·bollingerPercentB·hurst·varianceRatio)을 차트 pane으로 렌더한다. 신규 `statistical` 카테고리를 추가한다.

**Architecture:** PR #575의 레지스트리/모달/binding 구조 위에서, pane 지표 목록을 `INDICATOR_REGISTRY`의 `kind === 'pane'` 필터로 도출하고 `useIndicatorVisibility`가 `Record<IndicatorKey, boolean>` 단일 state + 동적 paneIndex 배정으로 N개를 관리한다. 7개 신규 pane 훅은 기존 `useRSIChart`를 복제한다. 모달·`groupBindingsByCategory`는 무수정 — 레지스트리 추가만으로 자동 노출.

**Tech Stack:** Next.js 16 / React 19 (`'use client'`), lightweight-charts 5.1.0, `@y0ngha/siglens-core`(IndicatorResult·기준선 상수), vitest + RTL, Playwright.

**작업 위치:** 워크트리 `/Users/y0ngha/Project/siglens-indicator-render`, 브랜치 `feat/render-unused-indicators` (base `feat/indicator-settings-modal`=PR #575). 스펙: `docs/superpowers/specs/2026-06-06-render-unused-indicators-group-b-design.md`.

**커밋 규칙:** 커밋은 `git-agent`에 위임(CLAUDE.md). 각 Task 끝의 commit은 git-agent로 수행, 직접 `git commit` 금지. `--no-verify` 금지.

---

## File Structure

**신규**
- `src/widgets/chart/constants/indicatorLevels.ts` — core에 없는 기준선 표시 상수(williamsR·%B·hurst·varianceRatio)
- `src/widgets/chart/hooks/useMfiChart.ts` 외 6개 pane 훅 (`useWilliamsRChart`·`useConnorsRsiChart`·`useCmfChart`·`useBollingerPercentBChart`·`useHurstChart`·`useVarianceRatioChart`)
- 각 훅의 colocated 테스트 + 신규 유틸 테스트

**수정**
- `src/widgets/chart/types.ts` — `PaneIndices`를 `Record<IndicatorKey, number>`로
- `src/widgets/chart/hooks/useIndicatorVisibility.ts` — 레지스트리 기반 재작성
- `src/widgets/chart/model/indicatorRegistry.ts` — 7개 메타 + `statistical` 카테고리 + `IndicatorKey`/`IndicatorCategory` union
- `src/widgets/chart/StockChart.tsx` — visibility 새 형태 적용(기존 6개 갱신) + 7개 훅 호출 + 7개 binding
- `src/widgets/chart/utils/paneLabelUtils.ts` — 7개 pane label
- `src/shared/lib/chartColors.ts` — 7종 라인/기준선 색
- `src/widgets/chart/__tests__/StockChart.test.tsx`, `src/__tests__/worst-case/chartResizeHydration.test.tsx`, `src/__tests__/worst-case/emptyChartData.test.tsx` — visibility mock 형태 갱신
- `e2e/specs/chart-indicators.spec.ts` — 통계 카테고리 시나리오

**불변 (회귀 위험 0)**
- 기존 6개 pane 훅(`useRSIChart`~`useCCIChart`), 오버레이 훅, `IndicatorSettingsModal`, `groupBindingsByCategory`, `buildSeriesDataFromValues`

---

## Task 0: 워크트리 node_modules 준비

- [ ] **Step 1: 하드링크 복제**

Run:
```bash
cp -al /Users/y0ngha/Project/siglens/node_modules /Users/y0ngha/Project/siglens-indicator-render/node_modules
rm -rf /Users/y0ngha/Project/siglens-indicator-render/node_modules/node_modules
```
Expected: 에러 없음.

- [ ] **Step 2: 러너 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts 2>&1 | tail -8`
Expected: 기존 레지스트리 테스트 PASS.

---

## Task 1: 레지스트리 확장 (7 메타 + statistical 카테고리)

**Files:**
- Modify: `src/widgets/chart/model/indicatorRegistry.ts`
- Modify: `src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`

- [ ] **Step 1: 테스트 갱신 (실패 유도)**

`indicatorRegistry.test.ts`의 `registers exactly the 11 modal-target indicators` 테스트를 18개로, label 테스트에 statistical 추가:
```ts
it('registers exactly the 18 modal-target indicators', () => {
    expect(INDICATOR_REGISTRY).toHaveLength(18);
});
```
그리고 `maps every category to its exact label` 테스트를 갱신:
```ts
it('maps every category to its exact label', () => {
    expect(CATEGORY_LABELS).toStrictEqual({
        trend: '추세',
        momentum: '모멘텀',
        volatility: '변동성',
        volume: '볼륨',
        statistical: '통계',
        smc: 'SMC',
    });
});
```
그리고 새 그룹 B 키 카테고리 검증 테스트 추가:
```ts
it('places group-B oscillators in the right categories', () => {
    const byKey = Object.fromEntries(
        INDICATOR_REGISTRY.map(m => [m.key, m.category])
    );
    expect(byKey.mfi).toBe('momentum');
    expect(byKey.williamsR).toBe('momentum');
    expect(byKey.connorsRsi).toBe('momentum');
    expect(byKey.cmf).toBe('momentum');
    expect(byKey.bollingerPercentB).toBe('volatility');
    expect(byKey.hurst).toBe('statistical');
    expect(byKey.varianceRatio).toBe('statistical');
});

it('all group-B indicators are pane kind', () => {
    const groupB = ['mfi', 'williamsR', 'connorsRsi', 'cmf', 'bollingerPercentB', 'hurst', 'varianceRatio'];
    for (const key of groupB) {
        expect(INDICATOR_META[key as IndicatorKey].kind).toBe('pane');
    }
});
```
(`type IndicatorKey`는 이미 import되어 있음.)

- [ ] **Step 2: Run → 실패 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: FAIL (length 11≠18, label에 statistical 없음).

- [ ] **Step 3: 레지스트리 구현**

`indicatorRegistry.ts`:
1. `IndicatorCategory` union에 `'statistical'` 추가:
```ts
export type IndicatorCategory =
    | 'trend'
    | 'momentum'
    | 'volatility'
    | 'volume'
    | 'statistical'
    | 'smc';
```
2. `IndicatorKey` union에 7개 키 추가:
```ts
export type IndicatorKey =
    | 'ma' | 'ema' | 'ichimoku'
    | 'rsi' | 'macd' | 'dmi' | 'stochastic' | 'stochRsi' | 'cci'
    | 'bollinger' | 'volumeProfile'
    | 'mfi' | 'williamsR' | 'connorsRsi' | 'cmf'
    | 'bollingerPercentB' | 'hurst' | 'varianceRatio';
```
3. `CATEGORY_LABELS`에 `statistical: '통계'` 추가 (momentum/volatility/volume 뒤, smc 앞 — 정의 순서가 표시 순서):
```ts
export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
    trend: '추세',
    momentum: '모멘텀',
    volatility: '변동성',
    volume: '볼륨',
    statistical: '통계',
    smc: 'SMC',
};
```
4. `INDICATOR_REGISTRY` 끝(volumeProfile 뒤)에 7개 추가:
```ts
    { key: 'mfi', label: 'MFI', category: 'momentum', kind: 'pane' },
    { key: 'williamsR', label: 'Williams %R', category: 'momentum', kind: 'pane' },
    { key: 'connorsRsi', label: 'CRSI', category: 'momentum', kind: 'pane' },
    { key: 'cmf', label: 'CMF', category: 'momentum', kind: 'pane' },
    { key: 'bollingerPercentB', label: '%B', category: 'volatility', kind: 'pane' },
    { key: 'hurst', label: 'Hurst', category: 'statistical', kind: 'pane' },
    { key: 'varianceRatio', label: 'VR', category: 'statistical', kind: 'pane' },
```

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/model/indicatorRegistry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (git-agent)**

`feat(chart): register group-B indicators and statistical category`

---

## Task 2: paneIndex 일반화 (useIndicatorVisibility 재작성 + 파급 갱신)

이 task는 visibility 반환 형태 변경의 파급(StockChart 기존 6개 호출부 + 테스트 mock)을 함께 흡수해 빌드를 green으로 유지한다.

**Files:**
- Modify: `src/widgets/chart/types.ts`, `src/widgets/chart/hooks/useIndicatorVisibility.ts`, `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts` (없으면 생성), `src/widgets/chart/__tests__/StockChart.test.tsx`, `src/__tests__/worst-case/chartResizeHydration.test.tsx`, `src/__tests__/worst-case/emptyChartData.test.tsx`

- [ ] **Step 1: useIndicatorVisibility 테스트 작성 (실패 유도)**

Create/replace `src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIndicatorVisibility } from '../../hooks/useIndicatorVisibility';
import { INACTIVE_PANE_INDEX } from '../../constants';

describe('useIndicatorVisibility', () => {
    it('starts with all pane indicators hidden (INACTIVE)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        expect(result.current.visible.rsi).toBe(false);
        expect(result.current.visible.mfi).toBe(false);
        expect(result.current.paneIndices.rsi).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.varianceRatio).toBe(
            INACTIVE_PANE_INDEX
        );
    });

    it('assigns compacted pane indices in registry order to active panes', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('mfi'));
        act(() => result.current.toggle('hurst'));
        // rsi(등록 4번째 pane), mfi, hurst만 활성 → 등록 순서대로 1,2,3
        expect(result.current.paneIndices.rsi).toBe(1);
        expect(result.current.paneIndices.mfi).toBe(2);
        expect(result.current.paneIndices.hurst).toBe(3);
        // 비활성은 INACTIVE
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
    });

    it('toggle off reassigns indices (worst case: middle removed)', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        act(() => result.current.toggle('rsi'));
        act(() => result.current.toggle('macd'));
        act(() => result.current.toggle('cci'));
        // rsi,macd,cci → 1,2,3
        act(() => result.current.toggle('macd')); // 가운데 제거
        expect(result.current.paneIndices.rsi).toBe(1);
        expect(result.current.paneIndices.macd).toBe(INACTIVE_PANE_INDEX);
        expect(result.current.paneIndices.cci).toBe(2);
    });

    it('exposes a paneIndices entry for every pane indicator', () => {
        const { result } = renderHook(() => useIndicatorVisibility());
        const paneKeys = [
            'rsi', 'macd', 'dmi', 'stochastic', 'stochRsi', 'cci',
            'mfi', 'williamsR', 'connorsRsi', 'cmf',
            'bollingerPercentB', 'hurst', 'varianceRatio',
        ] as const;
        for (const k of paneKeys) {
            expect(result.current.paneIndices[k]).toBe(INACTIVE_PANE_INDEX);
        }
    });
});
```

- [ ] **Step 2: Run → 실패 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts`
Expected: FAIL (`result.current.visible` undefined — 기존 반환은 rsiVisible 등).

- [ ] **Step 3: types.ts — PaneIndices 일반화**

`src/widgets/chart/types.ts`에서:
```ts
import type { IndicatorKey } from './model/indicatorRegistry';

export type PaneIndices = Record<IndicatorKey, number>;
```
(기존 6키 인터페이스 블록을 위 타입 별칭으로 교체.)

- [ ] **Step 4: useIndicatorVisibility 재작성**

`src/widgets/chart/hooks/useIndicatorVisibility.ts` 전체 교체:
```ts
'use client';

import { useCallback, useMemo, useState } from 'react';
import { FIRST_INDICATOR_PANE_INDEX, INACTIVE_PANE_INDEX } from '../constants';
import {
    INDICATOR_REGISTRY,
    type IndicatorKey,
} from '../model/indicatorRegistry';
import type { PaneIndices } from '../types';

// 레지스트리에서 pane 지표 키를 등록 순서대로 도출 (paneIndex 배정 순서의 기준).
const PANE_KEYS: readonly IndicatorKey[] = INDICATOR_REGISTRY.filter(
    m => m.kind === 'pane'
).map(m => m.key);

type VisibilityState = Record<IndicatorKey, boolean>;

interface UseIndicatorVisibilityReturn {
    visible: VisibilityState;
    toggle: (key: IndicatorKey) => void;
    paneIndices: PaneIndices;
}

function initialVisibility(): VisibilityState {
    return Object.fromEntries(
        PANE_KEYS.map(key => [key, false])
    ) as VisibilityState;
}

export function useIndicatorVisibility(): UseIndicatorVisibilityReturn {
    const [visible, setVisible] = useState<VisibilityState>(initialVisibility);

    const toggle = useCallback((key: IndicatorKey) => {
        setVisible(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    // 활성 pane에 등록 순서대로 1,2,3… 배정, 비활성은 INACTIVE_PANE_INDEX.
    const paneIndices: PaneIndices = useMemo(() => {
        let next = FIRST_INDICATOR_PANE_INDEX;
        return Object.fromEntries(
            PANE_KEYS.map(key => [
                key,
                visible[key] ? next++ : INACTIVE_PANE_INDEX,
            ])
        ) as PaneIndices;
    }, [visible]);

    return { visible, toggle, paneIndices };
}
```
> 주의: `paneIndices`는 PANE_KEYS(pane 지표)만 키로 갖는다. PaneIndices가 `Record<IndicatorKey, number>`라 overlay 키(ma 등) 접근 시 타입상 number지만 런타임 undefined다 — overlay 훅은 paneIndices를 쓰지 않으므로 문제없다. buildPaneLabels·StockChart도 pane 키만 접근한다.

- [ ] **Step 5: StockChart 기존 6개 호출부/binding 갱신**

`StockChart.tsx`에서:
1. 구조분해 교체:
```ts
const { visible, toggle, paneIndices } = useIndicatorVisibility();
```
2. 기존 6개 pane 훅 호출의 `isVisible`/콜백 갱신 (예시 RSI, 6개 모두 동일 패턴):
```ts
useRSIChart({ ...commonHookParams, isVisible: visible.rsi, paneIndex: paneIndices.rsi });
useMACDChart({ ...commonHookParams, isVisible: visible.macd, paneIndex: paneIndices.macd });
useDMIChart({ ...commonHookParams, isVisible: visible.dmi, paneIndex: paneIndices.dmi });
useStochasticChart({ ...commonHookParams, isVisible: visible.stochastic, paneIndex: paneIndices.stochastic });
useStochRSIChart({ ...commonHookParams, isVisible: visible.stochRsi, paneIndex: paneIndices.stochRsi });
useCCIChart({ ...commonHookParams, isVisible: visible.cci, paneIndex: paneIndices.cci });
```
3. `indicatorBindings` 배열의 기존 6개 pane binding 갱신 (active/onToggle):
```ts
{ meta: INDICATOR_META.rsi, active: visible.rsi, onToggle: () => toggle('rsi') },
{ meta: INDICATOR_META.macd, active: visible.macd, onToggle: () => toggle('macd') },
{ meta: INDICATOR_META.dmi, active: visible.dmi, onToggle: () => toggle('dmi') },
{ meta: INDICATOR_META.stochastic, active: visible.stochastic, onToggle: () => toggle('stochastic') },
{ meta: INDICATOR_META.stochRsi, active: visible.stochRsi, onToggle: () => toggle('stochRsi') },
{ meta: INDICATOR_META.cci, active: visible.cci, onToggle: () => toggle('cci') },
```
4. `indicatorBindings` useMemo 의존성 배열을 `[..., visible, toggle, paneIndices(불필요 시 제외)]` 형태로 갱신: overlay 값들 + `visible` + `toggle`. (기존 개별 toggleRSI 등 제거하고 `visible`, `toggle` 추가.)

- [ ] **Step 6: StockChart.test.tsx mock 갱신**

기존 `vi.mock('@/widgets/chart/hooks/useIndicatorVisibility', ...)`가 있으면 새 형태로 교체:
```ts
vi.mock('@/widgets/chart/hooks/useIndicatorVisibility', () => ({
    useIndicatorVisibility: () => ({
        visible: {
            ma: false, ema: false, ichimoku: false,
            rsi: false, macd: false, dmi: false,
            stochastic: false, stochRsi: false, cci: false,
            bollinger: false, volumeProfile: false,
            mfi: false, williamsR: false, connorsRsi: false, cmf: false,
            bollingerPercentB: false, hurst: false, varianceRatio: false,
        },
        toggle: vi.fn(),
        paneIndices: {
            ma: -1, ema: -1, ichimoku: -1,
            rsi: -1, macd: -1, dmi: -1,
            stochastic: -1, stochRsi: -1, cci: -1,
            bollinger: -1, volumeProfile: -1,
            mfi: -1, williamsR: -1, connorsRsi: -1, cmf: -1,
            bollingerPercentB: -1, hurst: -1, varianceRatio: -1,
        },
    }),
}));
```
> 단, StockChart.test의 binding-count 테스트가 11이면 18로 갱신해야 한다(Task 6에서 7개 binding 추가 후). Task 2 시점엔 아직 기존 11개 binding이므로 `data-count`는 11 유지 — Task 6에서 18로 변경. 이 mock의 visible/paneIndices에 신규 키를 미리 포함해도 무방(미사용 키).

- [ ] **Step 7: worst-case 2개 mock 갱신**

`chartResizeHydration.test.tsx`·`emptyChartData.test.tsx`의 `useIndicatorVisibility` mock을 Step 6과 동일한 새 형태(visible/toggle/paneIndices Record)로 교체. (기존 `rsiVisible: false, ..., paneIndices: {rsi:-1,...}` 6키 객체 → 위 18키 형태.)

- [ ] **Step 8: Run → 통과 (visibility + StockChart + worst-case)**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/hooks/useIndicatorVisibility.test.ts src/widgets/chart/__tests__/StockChart.test.tsx src/__tests__/worst-case/chartResizeHydration.test.tsx src/__tests__/worst-case/emptyChartData.test.tsx
```
Expected: 전부 PASS.

- [ ] **Step 9: tsc + 전체 차트 테스트 (회귀 확인)**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && npx tsc --noEmit 2>&1 | tail -3 && yarn test src/widgets/chart 2>&1 | tail -6`
Expected: tsc 0 errors, 기존 6개 pane 훅 테스트 포함 전부 PASS.

- [ ] **Step 10: Commit (git-agent)**

`refactor(chart): generalize useIndicatorVisibility to registry-driven N panes`

---

## Task 3: 기준선 표시 상수 + 색상

**Files:**
- Create: `src/widgets/chart/constants/indicatorLevels.ts`
- Modify: `src/shared/lib/chartColors.ts`
- Test: `src/widgets/chart/__tests__/constants/indicatorLevels.test.ts`

- [ ] **Step 1: 상수 테스트 작성 (실패 유도)**

Create `src/widgets/chart/__tests__/constants/indicatorLevels.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
    WILLIAMS_R_OVERBOUGHT_LEVEL,
    WILLIAMS_R_OVERSOLD_LEVEL,
    BOLLINGER_PERCENT_B_UPPER_LEVEL,
    BOLLINGER_PERCENT_B_LOWER_LEVEL,
    HURST_RANDOM_WALK_LEVEL,
    VARIANCE_RATIO_RANDOM_WALK_LEVEL,
} from '../../constants/indicatorLevels';

describe('indicatorLevels', () => {
    it('Williams %R bounds', () => {
        expect(WILLIAMS_R_OVERBOUGHT_LEVEL).toBe(-20);
        expect(WILLIAMS_R_OVERSOLD_LEVEL).toBe(-80);
    });
    it('Bollinger %B bounds', () => {
        expect(BOLLINGER_PERCENT_B_UPPER_LEVEL).toBe(1);
        expect(BOLLINGER_PERCENT_B_LOWER_LEVEL).toBe(0);
    });
    it('random-walk reference levels', () => {
        expect(HURST_RANDOM_WALK_LEVEL).toBe(0.5);
        expect(VARIANCE_RATIO_RANDOM_WALK_LEVEL).toBe(1);
    });
});
```

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/constants/indicatorLevels.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: 상수 구현**

Create `src/widgets/chart/constants/indicatorLevels.ts`:
```ts
/**
 * 차트 표시용 기준선 임계 — core 도메인 상수가 없는 지표의 시각화 기준선.
 * (mfi·connorsRsi·cmf는 core 상수 사용: MFI_OVERBOUGHT/OVERSOLD_LEVEL,
 *  CRSI_OVERBOUGHT/OVERSOLD, CMF_BULLISH_CROSS_LEVEL.)
 */

// Williams %R: -100~0 오실레이터, 통상 -20/-80.
export const WILLIAMS_R_OVERBOUGHT_LEVEL = -20;
export const WILLIAMS_R_OVERSOLD_LEVEL = -80;

// Bollinger %B: 0~1, 밴드 상단/하단.
export const BOLLINGER_PERCENT_B_UPPER_LEVEL = 1;
export const BOLLINGER_PERCENT_B_LOWER_LEVEL = 0;

// Hurst 지수: 0.5 = 랜덤워크 기준(>0.5 추세, <0.5 평균회귀).
export const HURST_RANDOM_WALK_LEVEL = 0.5;

// Variance Ratio: 1.0 = 랜덤워크 기준(>1 추세, <1 평균회귀).
export const VARIANCE_RATIO_RANDOM_WALK_LEVEL = 1;
```

- [ ] **Step 4: chartColors에 7종 색 추가**

`src/shared/lib/chartColors.ts`의 `CHART_COLORS` 객체에 추가 (기존 rsiLine/rsiOverbought 패턴):
```ts
    mfiLine: '#22d3ee',
    mfiOverbought: '#ef535060',
    mfiOversold: '#26a69a60',
    williamsRLine: '#c084fc',
    williamsROverbought: '#ef535060',
    williamsROversold: '#26a69a60',
    connorsRsiLine: '#f472b6',
    connorsRsiOverbought: '#ef535060',
    connorsRsiOversold: '#26a69a60',
    cmfLine: '#34d399',
    cmfZero: '#94a3b860',
    bollingerPercentBLine: '#818cf8',
    bollingerPercentBUpper: '#ef535060',
    bollingerPercentBLower: '#26a69a60',
    hurstLine: '#fbbf24',
    hurstReference: '#94a3b860',
    varianceRatioLine: '#fb923c',
    varianceRatioReference: '#94a3b860',
```

- [ ] **Step 5: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/constants/indicatorLevels.test.ts && npx tsc --noEmit 2>&1 | tail -2`
Expected: PASS, tsc 0 errors.

- [ ] **Step 6: Commit (git-agent)**

`feat(chart): add group-B indicator levels and colors`

---

## Task 4: 그룹 B 7개 pane 훅 (useRSIChart 복제)

7개 훅은 `useRSIChart`와 구조가 동일하다. 대표로 `useMfiChart` 전체를 제시하고, 나머지 6개는 치환 명세를 따른다.

**Files:**
- Create: `src/widgets/chart/hooks/useMfiChart.ts` 외 6개
- Test: 각 `src/widgets/chart/__tests__/hooks/use<Name>Chart.test.ts`

- [ ] **Step 1: useMfiChart 테스트 작성 (실패 유도)**

먼저 기존 `useRSIChart.test.ts`를 읽어 mock 구조(lightweight-charts mock 등)를 그대로 따른다. Create `src/widgets/chart/__tests__/hooks/useMfiChart.test.ts`를 useRSIChart 테스트와 동일 구조로 작성하되, indicators fixture를 `{ ...EMPTY, mfi: [10, 85, 50] }`로, 검증을 `addSeries` 호출 + `setData`가 mfi 값으로 호출되는지로 둔다. (useRSIChart.test.ts의 검증 항목을 1:1 대응: isVisible true→addSeries, false→removeSeries, paneIndex 변경→재생성, worst-case 빈 배열→setData 미호출.)

> 구현자 주의: useRSIChart.test.ts의 실제 mock/헬퍼를 복사해 키만 mfi로 바꾼다. 빈 데이터 worst-case(`mfi: []`)에서 setData가 호출되지 않아야 한다.

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/hooks/useMfiChart.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: useMfiChart 구현**

Create `src/widgets/chart/hooks/useMfiChart.ts`:
```ts
'use client';

import type { RefObject } from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { IChartApi, ISeriesApi, LineWidth } from 'lightweight-charts';
import { LineSeries, LineStyle } from 'lightweight-charts';
import { CHART_COLORS } from '@/shared/lib/chartColors';
import {
    type Bar,
    type IndicatorResult,
    MFI_OVERBOUGHT_LEVEL,
    MFI_OVERSOLD_LEVEL,
} from '@y0ngha/siglens-core';
import { DEFAULT_LINE_WIDTH } from '../constants';
import { buildSeriesDataFromValues } from '../utils/seriesDataUtils';

interface UseMfiChartParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
    lineWidth?: LineWidth;
    isVisible: boolean;
    paneIndex: number;
}

export function useMfiChart({
    chartRef,
    bars,
    indicators,
    lineWidth = DEFAULT_LINE_WIDTH,
    isVisible,
    paneIndex,
}: UseMfiChartParams): void {
    const prevChartRef = useRef<IChartApi | null>(null);
    const prevPaneIndexRef = useRef<number>(paneIndex);
    const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

    const clearSeriesRefs = useEffectEvent(() => {
        seriesRef.current = null;
    });

    const removeAllSeries = useEffectEvent((chart: IChartApi) => {
        if (seriesRef.current) {
            chart.removeSeries(seriesRef.current);
            seriesRef.current = null;
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
        if (prevPaneIndexRef.current !== paneIndex && seriesRef.current) {
            removeAllSeries(chart);
        }
        prevPaneIndexRef.current = paneIndex;

        if (!seriesRef.current) {
            seriesRef.current = chart.addSeries(
                LineSeries,
                {
                    color: CHART_COLORS.mfiLine,
                    lineWidth,
                    priceLineVisible: false,
                    lastValueVisible: false,
                },
                paneIndex
            );
            seriesRef.current.createPriceLine({
                price: MFI_OVERBOUGHT_LEVEL,
                color: CHART_COLORS.mfiOverbought,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: false,
                title: '',
            });
            seriesRef.current.createPriceLine({
                price: MFI_OVERSOLD_LEVEL,
                color: CHART_COLORS.mfiOversold,
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
        const { mfi } = indicators;
        if (!mfi.length) return;
        if (!seriesRef.current) return;
        seriesRef.current.setData(buildSeriesDataFromValues(bars, mfi));
    }, [indicators, bars, isVisible, paneIndex]);
}
```

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/hooks/useMfiChart.test.ts`
Expected: PASS.

- [ ] **Step 5: 나머지 6개 훅 + 테스트 작성 (useMfiChart 복제 + 치환)**

각 훅은 useMfiChart.ts를 복사해 아래 표대로 치환한다. 데이터 accessor가 단순 배열인 6종 중 5종은 `const { <key> } = indicators;` + `buildSeriesDataFromValues(bars, <key>)`. **`useBollingerPercentBChart`만** 데이터 추출이 다르다(아래 별도 명시). 각 훅마다 대응 테스트(useMfiChart.test 복제, 키·fixture 치환)도 작성한다.

| 파일 | 함수 | dataAccessor (effect 2) | 라인색 | 기준선 (createPriceLine) |
|---|---|---|---|---|
| `useWilliamsRChart.ts` | `useWilliamsRChart` | `indicators.williamsR` | `williamsRLine` | `WILLIAMS_R_OVERBOUGHT_LEVEL`(색 `williamsROverbought`) + `WILLIAMS_R_OVERSOLD_LEVEL`(색 `williamsROversold`) — import from `../constants/indicatorLevels` |
| `useConnorsRsiChart.ts` | `useConnorsRsiChart` | `indicators.connorsRsi` | `connorsRsiLine` | `CRSI_OVERBOUGHT`(색 `connorsRsiOverbought`) + `CRSI_OVERSOLD`(색 `connorsRsiOversold`) — import from `@y0ngha/siglens-core` |
| `useCmfChart.ts` | `useCmfChart` | `indicators.cmf` | `cmfLine` | 단일 zero line: `CMF_BULLISH_CROSS_LEVEL`(=0, 색 `cmfZero`) — import from core. createPriceLine 1개만. |
| `useBollingerPercentBChart.ts` | `useBollingerPercentBChart` | `indicators.bollingerDerived.map(d => d.pctB)` (아래 주의) | `bollingerPercentBLine` | `BOLLINGER_PERCENT_B_UPPER_LEVEL`(색 `bollingerPercentBUpper`) + `BOLLINGER_PERCENT_B_LOWER_LEVEL`(색 `bollingerPercentBLower`) — import from `../constants/indicatorLevels` |
| `useHurstChart.ts` | `useHurstChart` | `indicators.hurst` | `hurstLine` | 단일 reference line: `HURST_RANDOM_WALK_LEVEL`(=0.5, 색 `hurstReference`). createPriceLine 1개만. |
| `useVarianceRatioChart.ts` | `useVarianceRatioChart` | `indicators.varianceRatio` | `varianceRatioLine` | 단일 reference line: `VARIANCE_RATIO_RANDOM_WALK_LEVEL`(=1, 색 `varianceRatioReference`). createPriceLine 1개만. |

**`useBollingerPercentBChart`의 effect 2 (데이터 sync)는 다음으로 작성** (객체 배열에서 pctB 추출):
```ts
    useEffect(() => {
        if (!isVisible) return;
        const { bollingerDerived } = indicators;
        if (!bollingerDerived.length) return;
        if (!seriesRef.current) return;
        const pctB = bollingerDerived.map(d => d.pctB);
        seriesRef.current.setData(buildSeriesDataFromValues(bars, pctB));
    }, [indicators, bars, isVisible, paneIndex]);
```

cmf/hurst/varianceRatio는 기준선이 1개이므로 useMfiChart의 두 `createPriceLine` 블록을 해당 1개로 교체한다(예: useCmfChart는 `price: CMF_BULLISH_CROSS_LEVEL, color: CHART_COLORS.cmfZero` 하나).

- [ ] **Step 6: Run → 7개 훅 테스트 전부 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/hooks/ 2>&1 | tail -8`
Expected: 7개 신규 + 기존 훅 테스트 PASS.

- [ ] **Step 7: Commit (git-agent)**

`feat(chart): add 7 group-B oscillator pane hooks`

---

## Task 5: paneLabelUtils 7개 label

**Files:**
- Modify: `src/widgets/chart/utils/paneLabelUtils.ts`
- Modify: `src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts` (있으면)

- [ ] **Step 1: 테스트 보강 (실패 유도)**

`paneLabelUtils.test.ts`에 (없으면 생성) 신규 pane label 검증 추가:
```ts
it('builds labels for active group-B panes', () => {
    const paneIndices = {
        ma: -1, ema: -1, ichimoku: -1,
        rsi: -1, macd: -1, dmi: -1, stochastic: -1, stochRsi: -1, cci: -1,
        bollinger: -1, volumeProfile: -1,
        mfi: 1, williamsR: -1, connorsRsi: -1, cmf: -1,
        bollingerPercentB: -1, hurst: 2, varianceRatio: -1,
    };
    const labels = buildPaneLabels(paneIndices);
    const names = labels.flatMap(l => l.subLabels.map(s => s.name));
    expect(names.some(n => n.startsWith('MFI'))).toBe(true);
    expect(names.some(n => n.startsWith('Hurst'))).toBe(true);
});
```
(파일 상단에 `buildPaneLabels` import가 이미 있다고 가정; 없으면 추가.)

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`
Expected: FAIL (MFI/Hurst label 없음).

- [ ] **Step 3: buildPaneLabels에 7개 label 추가**

`paneLabelUtils.ts`의 `buildPaneLabels` 안에, 기존 cci label 패턴을 따라 7개 추가하고 반환 배열에 spread. 각 label 블록 형태 (mfi 예시):
```ts
    const mfiLabel: PaneLabelConfig[] =
        paneIndices.mfi !== INACTIVE_PANE_INDEX
            ? [{ paneIndex: paneIndices.mfi, subLabels: [{ name: 'MFI', color: CHART_COLORS.mfiLine }] }]
            : [];
```
7개 각각 (이름/색):
- `mfi` → `'MFI'`, `CHART_COLORS.mfiLine`
- `williamsR` → `'Williams %R'`, `CHART_COLORS.williamsRLine`
- `connorsRsi` → `'CRSI'`, `CHART_COLORS.connorsRsiLine`
- `cmf` → `'CMF'`, `CHART_COLORS.cmfLine`
- `bollingerPercentB` → `'%B'`, `CHART_COLORS.bollingerPercentBLine`
- `hurst` → `'Hurst'`, `CHART_COLORS.hurstLine`
- `varianceRatio` → `'VR'`, `CHART_COLORS.varianceRatioLine`

반환문에 7개 spread 추가:
```ts
    return [
        ...rsiLabel, ...macdLabel, ...dmiLabel, ...stochasticLabel,
        ...stochRsiLabel, ...cciLabel,
        ...mfiLabel, ...williamsRLabel, ...connorsRsiLabel, ...cmfLabel,
        ...bollingerPercentBLabel, ...hurstLabel, ...varianceRatioLabel,
    ];
```

- [ ] **Step 4: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/utils/paneLabelUtils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit (git-agent)**

`feat(chart): add pane labels for group-B indicators`

---

## Task 6: StockChart에 7개 훅 호출 + binding 추가

**Files:**
- Modify: `src/widgets/chart/StockChart.tsx`
- Modify: `src/widgets/chart/__tests__/StockChart.test.tsx`

- [ ] **Step 1: StockChart.test 의 binding-count·keys 단언 갱신 (실패 유도)**

`StockChart.test.tsx`의 `data-count` 테스트를 18로, keys 단언이 있으면 18키로 갱신:
```ts
expect(modal).toHaveAttribute('data-count', '18');
```
(keys 순서 단언이 있다면 기존 11키 뒤에 `mfi,williamsR,connorsRsi,cmf,bollingerPercentB,hurst,varianceRatio` 추가.)

- [ ] **Step 2: Run → 실패**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/StockChart.test.tsx`
Expected: FAIL (`data-count`가 아직 11).

- [ ] **Step 3: StockChart에 7개 훅 import + 호출**

import 추가:
```ts
import { useMfiChart } from './hooks/useMfiChart';
import { useWilliamsRChart } from './hooks/useWilliamsRChart';
import { useConnorsRsiChart } from './hooks/useConnorsRsiChart';
import { useCmfChart } from './hooks/useCmfChart';
import { useBollingerPercentBChart } from './hooks/useBollingerPercentBChart';
import { useHurstChart } from './hooks/useHurstChart';
import { useVarianceRatioChart } from './hooks/useVarianceRatioChart';
```
기존 6개 pane 훅 호출 뒤에 7개 호출 추가:
```ts
useMfiChart({ ...commonHookParams, isVisible: visible.mfi, paneIndex: paneIndices.mfi });
useWilliamsRChart({ ...commonHookParams, isVisible: visible.williamsR, paneIndex: paneIndices.williamsR });
useConnorsRsiChart({ ...commonHookParams, isVisible: visible.connorsRsi, paneIndex: paneIndices.connorsRsi });
useCmfChart({ ...commonHookParams, isVisible: visible.cmf, paneIndex: paneIndices.cmf });
useBollingerPercentBChart({ ...commonHookParams, isVisible: visible.bollingerPercentB, paneIndex: paneIndices.bollingerPercentB });
useHurstChart({ ...commonHookParams, isVisible: visible.hurst, paneIndex: paneIndices.hurst });
useVarianceRatioChart({ ...commonHookParams, isVisible: visible.varianceRatio, paneIndex: paneIndices.varianceRatio });
```

- [ ] **Step 4: indicatorBindings에 7개 binding 추가**

`indicatorBindings` 배열 끝(volumeProfile 뒤)에 추가:
```ts
{ meta: INDICATOR_META.mfi, active: visible.mfi, onToggle: () => toggle('mfi') },
{ meta: INDICATOR_META.williamsR, active: visible.williamsR, onToggle: () => toggle('williamsR') },
{ meta: INDICATOR_META.connorsRsi, active: visible.connorsRsi, onToggle: () => toggle('connorsRsi') },
{ meta: INDICATOR_META.cmf, active: visible.cmf, onToggle: () => toggle('cmf') },
{ meta: INDICATOR_META.bollingerPercentB, active: visible.bollingerPercentB, onToggle: () => toggle('bollingerPercentB') },
{ meta: INDICATOR_META.hurst, active: visible.hurst, onToggle: () => toggle('hurst') },
{ meta: INDICATOR_META.varianceRatio, active: visible.varianceRatio, onToggle: () => toggle('varianceRatio') },
```
useMemo 의존성: `visible`, `toggle`가 이미 deps에 있으면 충분(개별 active는 visible 객체 참조로 커버). 없으면 추가.

- [ ] **Step 5: Run → 통과**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test src/widgets/chart/__tests__/StockChart.test.tsx`
Expected: PASS (`data-count="18"`).

- [ ] **Step 6: tsc + 전체 차트 테스트**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && npx tsc --noEmit 2>&1 | tail -2 && yarn test src/widgets/chart 2>&1 | tail -6`
Expected: tsc 0, 전부 PASS.

- [ ] **Step 7: Commit (git-agent)**

`feat(chart): wire group-B oscillator hooks and bindings into StockChart`

---

## Task 7: 통합/E2E (statistical 카테고리)

**Files:**
- Modify: `e2e/specs/chart-indicators.spec.ts`

- [ ] **Step 1: E2E 시나리오 추가**

`chart-indicators.spec.ts`의 describe 안에 추가:
```ts
test('shows the statistical category and toggles MFI into a pane', async ({
    page,
}) => {
    await page.goto('/AAPL');
    await page.getByRole('button', { name: '보조지표 설정' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('통계')).toBeVisible();
    // MFI는 모멘텀 카테고리의 체크박스
    await dialog.getByRole('checkbox', { name: 'MFI', exact: true }).check();
    await page.getByRole('button', { name: '닫기' }).click();
    await expect(page.getByText('MFI')).toBeVisible();
});
```
> 셀렉터는 strict-mode 회피 위해 `exact: true`. '통계' 카테고리 heading은 hurst/varianceRatio 등록으로 생긴다.

- [ ] **Step 2: --list 로 로드 확인**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && npx playwright test e2e/specs/chart-indicators.spec.ts --list 2>&1 | tail -10`
Expected: 신규 테스트 포함 로드, import/문법 에러 없음.

- [ ] **Step 3: Commit (git-agent)**

`test(e2e): cover statistical category and MFI pane toggle`

> 풀 E2E 실행은 pre-push hook / CI가 담당(워크트리 docker-compose 공유 충돌 회피).

---

## Task 8: 최종 검증

- [ ] **Step 1: Lint**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn lint 2>&1 | tail -5`
Expected: 에러 0.

- [ ] **Step 2: 변경 영역 커버리지 90%+**

Run:
```bash
cd /Users/y0ngha/Project/siglens-indicator-render && npx vitest run --coverage \
  --coverage.include='src/widgets/chart/hooks/use*Chart.ts' \
  --coverage.include='src/widgets/chart/hooks/useIndicatorVisibility.ts' \
  --coverage.include='src/widgets/chart/constants/indicatorLevels.ts' \
  --coverage.thresholds.lines=0 --coverage.thresholds.functions=0 --coverage.thresholds.branches=0 --coverage.thresholds.statements=0 \
  src/widgets/chart/__tests__ 2>&1 | grep -E "All files|Stmts|----" | head
```
Expected: 신규 훅/visibility/levels 90%+ (미달 시 worst-case 테스트 보강).

- [ ] **Step 3: 전체 유닛 테스트**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn test 2>&1 | tail -12`
Expected: 전부 PASS, 회귀 없음.

- [ ] **Step 4: 빌드 (exit code 직접 캡처)**

Run: `cd /Users/y0ngha/Project/siglens-indicator-render && yarn build > /tmp/render-build.log 2>&1; echo "EXIT=$?"`
Expected: `EXIT=0`.

- [ ] **Step 5: review-agent 라우팅**

구현 완료 후 메인 오케스트레이터가 `review-agent`(Opus 4.8)를 호출 → findings 반영 → mistake-managing-agent → git-agent(push/PR). CLAUDE.md 워크플로우를 따른다.

---

## Self-Review (작성자 점검 결과)

- **스펙 커버리지**: §5.1(visibility 일반화)=Task 2, §5.2(7훅)=Task 4, §5.3(레지스트리)=Task 1, §5.4(StockChart binding)=Task 2+6, §5.5(색)=Task 3, §4(기준선)=Task 3+4, §7(테스트)=각 Task+Task 8, §3(statistical)=Task 1. 전부 매핑됨.
- **Placeholder**: 없음. 7개 훅 중 대표(useMfiChart) 풀코드 + 나머지는 구체 치환표(파일/함수/accessor/색/기준선 상수 전부 명시)로 실제 내용 제공. useBollingerPercentBChart의 특수 accessor는 별도 풀코드.
- **타입 일관성**: `IndicatorKey`(18키)·`PaneIndices=Record<IndicatorKey,number>`·`visible`/`toggle`/`paneIndices` 반환 형태가 Task 2 정의와 Task 5·6 사용처 일치. binding 키(`INDICATOR_META.<key>`)가 Task 1 레지스트리 키와 일치.
- **순서 의존**: Task 1(레지스트리)→2(visibility, PANE_KEYS 의존)→3(상수)→4(훅, 상수/레지스트리 의존)→5(label)→6(StockChart, 훅 의존)→7(E2E). Task 2가 visibility 변경 파급(StockChart 기존 6개 + 테스트 mock)을 흡수해 중간 빌드 green 유지.
