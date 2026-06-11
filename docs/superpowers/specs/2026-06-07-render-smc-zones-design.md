# 미사용 보조지표 렌더링 — 9차(그룹 D-2, 마지막): smc zone (premium/discount/equilibrium 가격 밴드)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-smc-zones` (base: `feat/render-elder-impulse` = PR #587)

## 1. 배경

미사용 보조지표 렌더링 마지막 차수. 그룹 D-2 **smc zone**을 렌더한다. SMC(Smart Money Concepts)의 premium/discount/equilibrium **가격 밴드** 3개를 가격선으로 표시한다. SMC의 나머지(swingHighs/Lows, orderBlocks, fairValueGaps, equalHighs/Lows, structureBreaks)는 스코프 밖. 계산은 `@y0ngha/siglens-core`에 있어 추가 작업은 siglens 렌더링뿐. 이걸로 미사용 지표 렌더링 전체가 마무리된다.

## 2. 자료조사 / 렌더 표준

- **SMC zones**: premium=equilibrium 위(매도/저항 영역, 빨강), discount=equilibrium 아래(매수/지지 영역, 초록/teal), equilibrium=스윙 고저의 50% 공정가(중립 회색). TradingView SMC들은 배경 채움 박스로 그리나, 본 구현은 **렌더 방식으로 priceLine 경계선을 선택**(사용자 결정 — 단순·저위험, 기존 actionEntry 가격선과 동일 메커니즘).
- DESIGN.md 매핑: premium=`#ef5350`(bearish), discount=`#26a69a`(bullish), equilibrium=`#94a3b8`(neutral).

데이터(siglens-core `domain/types.d.ts`):
```ts
type SMCZoneType = 'premium' | 'discount' | 'equilibrium';
interface SMCZone { high: number; low: number; type: SMCZoneType; }
// SMCResult.premiumZone / discountZone / equilibriumZone: SMCZone | null
// IndicatorResult.smc: SMCResult (객체형 — 시리즈 전체 요약)
```

기존 `useActionRecommendationOverlay`가 메인 캔들 시리즈에 `createPriceLine`으로 가격선을 그리는 정확한 레퍼런스다(`seriesRef` + `priceLinesRef: IPriceLine[]` 추적 + `isVisible` 게이팅 + 변경 시 전체 `removePriceLine` 후 재생성).

## 3. 핵심 설계 결정

### 3.1 `buildSmcZoneLines(smc)` 순수 헬퍼
선택한 렌더(premium/discount = high·low 2선, equilibrium = 50% 중간선 1선)를 가격선 스펙으로 변환한다:
```ts
// utils/smcZoneUtils.ts
import type { SMCResult } from '@y0ngha/siglens-core';
import { CHART_COLORS } from '@/shared/lib/chartColors';

export interface SmcZoneLine {
    price: number;
    color: string;
    title: string;
}

export function buildSmcZoneLines(smc: SMCResult | undefined): SmcZoneLine[] {
    if (!smc) return [];
    const lines: SmcZoneLine[] = [];
    const { premiumZone, discountZone, equilibriumZone } = smc;
    if (premiumZone) {
        lines.push({ price: premiumZone.high, color: CHART_COLORS.smcPremium, title: 'Premium' });
        lines.push({ price: premiumZone.low, color: CHART_COLORS.smcPremium, title: '' });
    }
    if (discountZone) {
        lines.push({ price: discountZone.high, color: CHART_COLORS.smcDiscount, title: 'Discount' });
        lines.push({ price: discountZone.low, color: CHART_COLORS.smcDiscount, title: '' });
    }
    if (equilibriumZone) {
        const mid = (equilibriumZone.high + equilibriumZone.low) / 2;
        lines.push({ price: mid, color: CHART_COLORS.smcEquilibrium, title: 'Equilibrium' });
    }
    return lines;
}
```
- null 존은 스킵. premium/discount는 밴드(2선, 대표 high선에만 title), equilibrium은 50% 공정가 1선. 최대 5선.

### 3.2 `useSmcZones` 훅 (`hooks/useSmcZones.ts`)
`useActionRecommendationOverlay` 골격 복제:
```ts
interface UseSmcZonesParams {
    seriesRef: RefObject<ISeriesApi<'Candlestick', UTCTimestamp> | null>;
    smc: SMCResult | undefined;
    isVisible: boolean;
    lineWidth?: LineWidth;
}
export function useSmcZones({ seriesRef, smc, isVisible, lineWidth = DEFAULT_LINE_WIDTH }: UseSmcZonesParams): void {
    const priceLinesRef = useRef<IPriceLine[]>([]);
    useEffect(() => {
        const series = seriesRef.current;
        priceLinesRef.current.forEach(pl => series?.removePriceLine(pl));
        priceLinesRef.current = [];
        if (!series || !isVisible) return;
        const lines = buildSmcZoneLines(smc);
        if (lines.length === 0) return;
        priceLinesRef.current = lines.map(l =>
            series.createPriceLine({
                price: l.price,
                color: l.color,
                lineWidth,
                lineStyle: LineStyle.Dashed,
                axisLabelVisible: l.title !== '',
                title: l.title,
            })
        );
    }, [smc, isVisible, lineWidth, seriesRef]);
}
```
- `lineStyle: LineStyle.Dashed`(action 가격선과 동일 톤). `axisLabelVisible`은 title 있는 대표선만 true(축 혼잡 완화).

### 3.3 색상 (`shared/lib/chartColors.ts` + `globals.css`)
DESIGN.md 시맨틱 매핑:
```ts
smcPremium: '#ef5350',     // 매도/저항 (bearish)
smcDiscount: '#26a69a',    // 매수/지지 (bullish)
smcEquilibrium: '#94a3b8', // 50% 공정가 (neutral)
```
globals.css @theme: `--color-chart-smc-premium/discount/equilibrium` 미러.

### 3.4 레지스트리 (신규 kind `zone`)
- `IndicatorKind` += `'zone'`(레지스트리 헤더 주석이 이미 예고).
- `IndicatorKey` += `'smc'`.
- `INDICATOR_REGISTRY` += `{ key: 'smc', label: 'SMC Zones', category: 'smc', kind: 'zone' }`. 33→34.
- `smc` 카테고리는 `CATEGORY_LABELS`에 이미 존재('SMC'). 지금까지 항목이 0이라 `groupBindingsByCategory`가 숨겼으나, 이제 **모달에 'SMC' 그룹이 처음 표시**된다.
- `zone`은 pane 아님 → `useIndicatorVisibility`의 `kind === 'pane'` 필터에 안 걸려 pane index 미할당. 가시성은 `visible.smc` + `toggle('smc')`(모든 키 초기화).
- 모달은 kind 무관이라 무수정(SMC 그룹 자동 노출).
- makePaneIndices(paneLabelUtils.test) fallout: `smc: INACTIVE_PANE_INDEX` +1.

### 3.5 StockChart 배선
- `useSmcZones({ seriesRef, smc: indicators.smc, isVisible: visible.smc })` 호출(`seriesRef`는 이미 StockChart에 존재 — useActionRecommendationOverlay에 전달 중).
- `indicatorBindings` += `{ meta: INDICATOR_META.smc, active: visible.smc, onToggle: () => toggle('smc') }` (33→34). `visible`/`toggle`은 이미 deps에 포함.
- 범례·pane 라벨 없음(가격선 + 축 라벨이 표현).

## 4. 데이터 흐름
```
indicatorRegistry (smc = kind:'zone', category:'smc')
        │
useIndicatorVisibility → visible.smc (pane index 없음)
        │
binding(34개) → IndicatorSettingsModal에 'SMC' 그룹 처음 노출
        │
체크 → toggle('smc') → visible.smc=true
        │
useSmcZones effect → buildSmcZoneLines(indicators.smc) → 메인 캔들 시리즈에 createPriceLine(최대 5선)
        │
premium(빨강 high/low) · discount(teal high/low) · equilibrium(회색 50% 1선). off 시 removePriceLine 전부.
```

## 5. 테스트 전략 (vitest + RTL, 90%+, happy + worst)

### 5.1 단위 — `buildSmcZoneLines`
- 3존 모두 존재 → 5선(premium 2 + discount 2 + equilibrium 1), 색·title 정확.
- equilibrium price = (high+low)/2 (midpoint) 검증.
- null 존 스킵(premium만/discount만/equilibrium만/전부 null→[]).
- smc undefined → [].
- premium/discount는 high선 title 있음, low선 title ''(빈 문자열).

### 5.2 단위 — `useSmcZones` (jsdom, lightweight-charts mock)
- isVisible true + 3존 → createPriceLine 5회.
- isVisible false → createPriceLine 미호출 + 기존 removePriceLine.
- series null → 미생성.
- 존 없음(smc undefined/전부 null) → 미생성.
- smc 변경 시 기존 전부 removePriceLine 후 재생성(개수 갱신).
- createPriceLine 인자(price/color/title/lineStyle Dashed/axisLabelVisible) 정확(인자 캡처).

### 5.3 레지스트리/모달
- 레지스트리 34, smc가 smc 카테고리·zone kind, 중복 없음.
- `groupBindingsByCategory`: smc 바인딩 포함 시 'SMC' 그룹이 결과에 노출(이전엔 빈 그룹이라 제외).

### 5.4 StockChart
- binding 34 + data-keys에 smc 추가. INACTIVE_PANES에 smc 추가, visible mock에 smc:false.

### 5.5 E2E
- `chart-indicators.spec.ts` 확장: 모달에서 'SMC Zones' 체크 → zone은 pane/overlay 라벨이 없으므로 **모달 체크박스 상태로 검증**(initial unchecked → check → checked, exact 매처). 추가로 'SMC' 카테고리 그룹이 모달에 보이는지 검증 가능.

## 6. FSD 준수
- 헬퍼·훅·색: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(SMCResult/SMCZone). 레이어 정상. core 무변경.

## 7. 후속
- **미사용 보조지표 렌더링 전체 완료.** SMC 나머지 요소(swing/orderBlock/FVG/structureBreak)는 스코프 밖 — 필요 시 별도 스펙.
