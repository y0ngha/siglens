# 미사용 보조지표 렌더링 — 5차: Supertrend (trend 색 오버레이)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-supertrend` (base: `feat/render-group-a-bands` = PR #581)

## 1. 배경

미사용 보조지표 렌더링 5차. 그룹 A 나머지(supertrend·chandelier·parabolicSar) 중 **supertrend** 1종을 가격 오버레이로 렌더한다. keltner/donchian(#581)에 이어 overlay 메커니즘을 쓰되, **trend 방향별 색**이라는 새 렌더 요소가 추가된다.

계산은 `@y0ngha/siglens-core`에 있으므로 추가 작업은 siglens 차트 렌더링뿐.

## 2. 자료조사 / 이미지 확인 결과

웹 자료조사(TradingView·Mudrex 등) + 이미지 확인:
- **Supertrend**: 가격 차트 위 **단일 연속 라인**으로, trend에 따라 색이 바뀐다. **trend up = 초록(가격 아래, 동적 지지)**, **trend down = 빨강(가격 위, 동적 저항)**. 추세 반전(flip) 시 라인 색이 전환되며 라인이 점프한다.
- 데이터: `supertrend: SupertrendResult[]` where `{ supertrend: number | null, trend: 'up' | 'down' | null }`. trend는 `TrendDirection`(PriceTrend|null), warm-up은 null.

## 3. 핵심 설계 결정

### trend 색 라인 = up/down 2 LineSeries
lightweight-charts `LineSeries`는 per-point 색을 지원하지 않는다(단색). 따라서 trend별 색을 표현하려면 **2개의 LineSeries**(up=초록, down=빨강)로 분리한다:
- 각 bar에서 `trend === 'up'`이면 **up 시리즈**에 `supertrend` 값, down 시리즈에는 whitespace(`{ time }`만).
- `trend === 'down'`이면 반대.
- `trend === null`(warm-up) 또는 `supertrend === null`이면 양쪽 모두 whitespace.
- flip 지점에서는 자연스럽게 한 시리즈가 끊기고 다른 시리즈가 시작 → 표준 supertrend의 "색 전환 + 라인 점프" 동작과 일치.

| 항목 | 결정 | 근거 |
|---|---|---|
| 1차 범위 | supertrend 1종만 | trend 색 2시리즈 패턴 첫 도입, 검증 (사용자 선택) |
| trend 색 | up/down 2 LineSeries + whitespace 분리 | LineSeries per-point 색 미지원; 표준 = 색 필수 |
| 훅 구조 | overlay (자체 isVisible/toggle, Pane 0) | keltner/bollinger overlay 패턴 |
| 카테고리 | `trend` | trend-following 지표(MA/EMA/ichimoku와 동류) |
| 데이터 빌더 | 신규 `buildTrendSplitData` 헬퍼 | buildSeriesData(단순 키 추출)로는 trend 조건 분리 불가 |

## 4. 아키텍처

### 4.1 `utils/seriesDataUtils.ts` — `buildTrendSplitData` 헬퍼 (신규)
```ts
// trend 방향이 dir과 일치하는 bar만 supertrend 값을, 나머지는 whitespace를 반환.
// up/down 2개 LineSeries로 trend별 색을 표현하기 위함(LineSeries는 per-point 색 미지원).
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
(seriesDataUtils의 SeriesPoint/UTCTimestamp 기존 import 재사용. SupertrendResult는 core import.)

### 4.2 `hooks/useSupertrendOverlay.ts`
- bollinger/keltner overlay 골격(자체 `useState(isVisible)`+toggle, prevChartRef, clearSeriesRefs/removeAllSeries useEffectEvent, 2-effect lifecycle/data-sync).
- 시리즈 **2개**: `upSeriesRef`(LineSeries, color=supertrendUp), `downSeriesRef`(LineSeries, color=supertrendDown). (Area 아님 — 채움 없는 라인.)
- 데이터 sync: `upSeriesRef.setData(buildTrendSplitData(bars, indicators.supertrend, 'up'))`, down도 'down'. guard `if (!indicators.supertrend.length) return`.
- 반환 `{ isVisible, toggle }`.

### 4.3 레지스트리 (`model/indicatorRegistry.ts`)
- `IndicatorKey` +1 (`supertrend`).
- `INDICATOR_REGISTRY` +1: `{ key: 'supertrend', label: 'Supertrend', category: 'trend', kind: 'overlay' }`.
- 카테고리 union·CATEGORY_LABELS 무변경(`trend` 존재).
- makePaneIndices(paneLabelUtils.test) fallout: `supertrend: INACTIVE_PANE_INDEX` 추가(overlay라 buildPaneLabels 미사용).

### 4.4 색상 (`shared/lib/chartColors.ts`)
- `supertrendUp`(초록 계열, 미사용 hex), `supertrendDown`(빨강 계열, 미사용 hex). 라인색 중복 grep 검증.

### 4.5 OverlayLegend (`utils/overlayLabelUtils.ts`)
- params +`supertrendVisible: boolean`.
- config: `{ name: 'Supertrend', color: CHART_COLORS.supertrendUp, getValue: (ind, i) => ind.supertrend[i]?.supertrend ?? null }` (trend 무관 단일 현재값; 색은 up 색으로 대표).

### 4.6 StockChart (`StockChart.tsx`)
- `useSupertrendOverlay(commonHookParams)` 호출 → `{ isVisible: supertrendVisible, toggle: toggleSupertrend }`.
- `buildOverlayLabelConfigs`에 `supertrendVisible` 전달 + deps.
- `indicatorBindings` +1 (26→27): `{ meta: INDICATOR_META.supertrend, active: supertrendVisible, onToggle: toggleSupertrend }` + deps에 supertrendVisible/toggleSupertrend.

## 5. 데이터 흐름
```
indicatorRegistry (supertrend = kind:'overlay', trend)
        │
StockChart: useSupertrendOverlay (자체 visible state)
        │
binding(27개) → IndicatorSettingsModal 자동 노출(무수정)
        │
체크 → toggle → Pane 0에 up/down 2 LineSeries 생성, buildTrendSplitData로 trend별 분리 데이터
```

## 6. 테스트 전략 (vitest + RTL, 90%+, happy + worst)

### 6.1 단위
- **`buildTrendSplitData`** 순수 함수: trend==='up'/'down' 일치 시 값, 불일치/null trend/null supertrend 시 whitespace. up/down 호출 시 상보적 분리 확인. bars/data 길이 불일치 worst-case.
- **`useSupertrendOverlay`**: isVisible true→2 LineSeries 생성(addSeries 2회), false→removeSeries, 데이터 sync(up/down setData), worst-case(빈 배열→setData 미호출).
- **레지스트리**: 27개, supertrend가 trend·overlay, 키 중복 없음.
- **overlayLabelUtils**: supertrendVisible 시 'Supertrend' config, getValue 정확.

### 6.2 E2E
- `chart-indicators.spec.ts` 확장: 모달에서 Supertrend 체크 → 체크 상태 검증(overlay라 모달 상태로, #581 keltner 패턴).

### 6.3 회귀
- 기존 overlay/pane 훅·useIndicatorVisibility·모달 무변경. StockChart binding 26→27, overlayLabelConfigs params 확장으로 기존 테스트 갱신.

## 7. FSD 준수
- 훅·레지스트리·색·legend·헬퍼: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(SupertrendResult/IndicatorResult). 레이어 정상. core 무변경.

## 8. 후속 (별도 스펙)
- chandelierExit(stop 라인+trend), parabolicSar(점 마커) — 그룹 A 나머지.
- C-복합 3종, 그룹 D, 전송 페이로드 슬림화.
