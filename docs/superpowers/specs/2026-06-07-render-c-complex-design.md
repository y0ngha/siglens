# 미사용 보조지표 렌더링 — 7차: C-복합 3종 (elderRay · squeezeMomentum · regression)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-c-complex` (base: `feat/render-group-a-rest` = PR #584)

## 1. 배경

미사용 보조지표 렌더링 7차. C-복합 3종(elderRay·squeezeMomentum·regression)을 **별도 Pane** 지표(`kind:'pane'`)로 렌더한다. C-simple(단일 라인 오실레이터)과 달리 히스토그램·상태 점·다값(투명도 인코딩) 등 복합 렌더 요소가 들어간다. 한 spec/PR로 묶되 지표별 task로 분해한다(사용자 선택). 계산은 `@y0ngha/siglens-core`에 있어 추가 작업은 siglens 차트 렌더링뿐.

## 2. 자료조사 / 렌더 표준

웹 자료조사(TradingView LazyBear, gocharting, TradingTechnologies) 결과:
- **Squeeze Momentum (LazyBear)**: 모멘텀 히스토그램을 4색으로 — 양수&증가=밝은 초록(강한 상승), 양수&감소=어두운 초록(약화), 음수&증가=어두운 빨강(회복), 음수&감소=밝은 빨강(강한 하락). 0(mid)라인 위에 squeeze 상태 점 — squeeze ON(압축 형성)/OFF(해제)/none(없음)을 색으로 구분.
- **Elder Ray**: bullPower(High−EMA13, 양수 우세)·bearPower(Low−EMA13, 음수 우세)를 **2개 히스토그램**으로 한 pane에서 0라인 기준 표시. bullPower 양수=초록, bearPower 음수=빨강, 반대 부호 막대는 회색(중립).
- **Regression**: 표준 단일 렌더 없음. slope(추세 방향/강도)와 r2(적합도 0~1)는 스케일이 달라 한 축 공유 불가 → **slope 히스토그램(부호 색) + 막대 투명도=r2**(신뢰도 낮으면 흐릿)로 단일 pane에 압축 표현(사용자 선택).

데이터(siglens-core `domain/types.d.ts`):
```ts
interface ElderRayResult { bullPower: number | null; bearPower: number | null; }
interface SqueezeMomentumResult {
    momentum: number | null;
    sqzOn: boolean | null; sqzOff: boolean | null; noSqz: boolean | null;
    increasing: boolean | null;
}
interface RegressionResult { slope: number | null; r2: number | null; }
// IndicatorResult.elderRay/squeezeMomentum/regression: 각 []
```

기존 `useMACDChart`가 히스토그램 pane + per-bar colorFn 레퍼런스. pane 지표는 `useIndicatorVisibility`가 `kind:'pane'`을 필터해 paneIndex를 자동 배정하고 StockChart가 `paneIndices.<key>`를 전달한다.

## 3. 공통 인프라 (소규모 일반화)

### 3.1 `buildSeriesData` colorFn 행(row) 인지 확장
현재 `colorFn?: (value: number) => string`은 값만 받아, squeeze 4색(`increasing` 필요)·regression 투명도(`r2` 필요)를 결정할 수 없다. **하위호환 확장**:
```ts
export function buildSeriesData<K extends string, T extends Record<K, number | null | undefined>>(
    bars: Bar[],
    indicatorData: T[],
    key: K,
    colorFn?: (value: number, row: T, index: number) => string
): SeriesPoint[]
```
- 구현: 색 분기에서 `colorFn(value, indicatorData[i] as T, i)` 호출(이 분기는 `value !== null`이므로 행 존재).
- MACD의 `value => value >= 0 ? ... : ...`는 인자 수가 적어도 그대로 유효(하위호환). 기존 호출부 무변경.

### 3.2 `buildZeroLineDots` 신규 빌더 (squeeze 상태 점)
```ts
// 각 bar에 0라인 위 점({ time, value: 0, color }), 행이 null이면 whitespace.
export function buildZeroLineDots<T>(
    bars: Bar[],
    data: T[],
    colorFn: (row: T) => string | null
): SeriesPoint[]
```
- `colorFn(row)`이 null 반환 시 해당 bar는 whitespace(점 없음).

## 4. 지표별 렌더

### 4.1 `useElderRayChart` (pane) — `hooks/useElderRayChart.ts`
- MACD 훅 골격(paneIndex, prevPaneIndexRef, 2-effect lifecycle/data-sync, paneIndex 변경 시 재생성).
- 2 HistogramSeries(`bullSeriesRef`, `bearSeriesRef`), 둘 다 `paneIndex` 지정.
- 데이터: `buildSeriesData(bars, elderRay, 'bullPower', v => v >= 0 ? CHART_COLORS.elderBullPower : CHART_COLORS.neutral)`, bear는 `'bearPower', v => v <= 0 ? CHART_COLORS.elderBearPower : CHART_COLORS.neutral`.

### 4.2 `useSqueezeMomentumChart` (pane) — `hooks/useSqueezeMomentumChart.ts`
- MACD 훅 골격 + 시리즈 2개: `momentumSeriesRef`(HistogramSeries), `stateDotsSeriesRef`(LineSeries, `lineVisible:false`+`pointMarkersVisible:true`+`pointMarkersRadius: DEFAULT_POINT_MARKERS_RADIUS`).
- 모멘텀: `buildSeriesData(bars, squeezeMomentum, 'momentum', (v, row) => squeezeMomentumColor(v, row.increasing))`.
- 상태 점: `buildZeroLineDots(bars, squeezeMomentum, squeezeStateColor)`.
- 순수 함수(별도 util):
  - `squeezeMomentumColor(value, increasing)`: v>0 → increasing ? `squeezeMomentumUp` : `squeezeMomentumUpWeak`; v≤0 → increasing ? `squeezeMomentumDownWeak` : `squeezeMomentumDown`.
  - `squeezeStateColor(row)`: `noSqz` → `squeezeNone`; `sqzOn` → `squeezeOn`; `sqzOff` → `squeezeOff`; 모두 false/null → null(점 없음).

### 4.3 `useRegressionChart` (pane) — `hooks/useRegressionChart.ts`
- MACD 훅 골격 + 1 HistogramSeries(`slopeSeriesRef`).
- 데이터: `buildSeriesData(bars, regression, 'slope', (v, row) => regressionBarColor(v, row.r2))`.
- 순수 함수 `regressionBarColor(slope, r2)`: 부호로 teal(`regressionUp`)/red(`regressionDown`) 선택, alpha = clamp(r2 ?? FALLBACK, 0, 1). teal/red의 RGB는 util 상수로(`#26a69a`=38,166,154 / `#ef5350`=239,83,80), `rgba(r,g,b,alpha)` 반환. r2 null → 낮은 기본 alpha(예 0.25)로 "신뢰도 미확정".

## 5. 색상 (`shared/lib/chartColors.ts` + `globals.css` @theme)

DESIGN.md 추세 고정값(teal `#26a69a` / red `#ef5350`) 기반, 강/약은 alpha 변형. 상태 점은 추세 무관 상태 팔레트.
```ts
// Elder Ray
elderBullPower: '#26a69a',
elderBearPower: '#ef5350',
// Squeeze Momentum 히스토그램 (강=solid, 약=50% alpha)
squeezeMomentumUp: '#26a69a',
squeezeMomentumUpWeak: '#26a69a80',
squeezeMomentumDown: '#ef5350',
squeezeMomentumDownWeak: '#ef535080',
// Squeeze 상태 점 (상태 팔레트 — 추세 무관)
squeezeOn: '#fbbf24',   // 압축 형성(에너지 축적)
squeezeOff: '#94a3b8',  // 해제(발화)
squeezeNone: '#3b82f6', // 스퀴즈 없음
// Regression (alpha는 r2로 런타임 계산)
regressionUp: '#26a69a',
regressionDown: '#ef5350',
```
globals.css @theme: solid 항목을 `--color-chart-*` 토큰으로 미러(group-A 선례). alpha 변형(`#...80`)·런타임 alpha는 JS 전용이라 미러 불필요.

## 6. 레지스트리 / pane 라벨 / StockChart

### 6.1 레지스트리 (`model/indicatorRegistry.ts`)
- `IndicatorKey` +3 (`elderRay`, `squeezeMomentum`, `regression`).
- `INDICATOR_REGISTRY` +3: elderRay `{ category:'momentum', kind:'pane' }`, squeezeMomentum `{ category:'momentum', kind:'pane' }`, regression `{ category:'statistical', kind:'pane' }`. 라벨 `Elder Ray` / `Squeeze` / `Regression`.
- 29→32. makePaneIndices(paneLabelUtils.test) fallout +3(기본 INACTIVE). StockChart.test binding 29→32 + data-keys.

### 6.2 pane 라벨 (`utils/paneLabelUtils.ts`)
- elderRay: 2 sub-label(`Bull Power`=elderBullPower, `Bear Power`=elderBearPower) — MACD식 인라인.
- squeezeMomentum: 1 sub-label(`Squeeze`=squeezeMomentumUp) — `buildSinglePaneLabel`.
- regression: 1 sub-label(`Regression`=regressionUp) — `buildSinglePaneLabel`.
- `buildPaneLabels` 반환 배열에 3개 추가.

### 6.3 StockChart (`StockChart.tsx`)
- `useElderRayChart`/`useSqueezeMomentumChart`/`useRegressionChart` 호출, 각 `paneIndex: paneIndices.<key>`.
- `indicatorBindings` +3 (29→32): `INDICATOR_META.<key>` + active(`visible.<key>`) + `onToggle: () => toggle('<key>')` (pane 지표는 useIndicatorVisibility의 visible/toggle 사용, group-A overlay와 달리).

## 7. 데이터 흐름
```
indicatorRegistry (3종 = kind:'pane')
        │
useIndicatorVisibility → visible{...}, paneIndices{elderRay, squeezeMomentum, regression}
        │
StockChart: use<X>Chart({ paneIndex: paneIndices.<x> })
        │
binding(32개) → IndicatorSettingsModal 자동 노출(무수정)
        │
체크 → toggle → 해당 paneIndex에:
  - ElderRay: bull/bear 2 HistogramSeries(0라인 기준 색)
  - Squeeze: 모멘텀 4색 Histogram + 0라인 상태 점(3색)
  - Regression: slope Histogram(부호 색 + r2 투명도)
buildSeriesData(row 인지 colorFn) / buildZeroLineDots로 데이터 생성
```

## 8. 테스트 전략 (vitest + RTL, 90%+, happy + worst)

### 8.1 단위 — 유틸/순수 함수
- **`buildSeriesData` colorFn row 인자**: colorFn이 (value, row, index)를 받는지, 기존 (value)=>... 하위호환 유지, null→whitespace.
- **`buildZeroLineDots`**: value=0 점·색, colorFn null 반환 시 whitespace, null 행 whitespace, 길이 불일치.
- **`squeezeMomentumColor`**: 4분기(양수/음수 × increasing T/F) 정확 + 0 경계.
- **`squeezeStateColor`**: noSqz/sqzOn/sqzOff 우선순위, 전부 false/null→null.
- **`regressionBarColor`**: 부호별 hue, alpha=r2 클램프, r2 null→기본 alpha, rgba 포맷.

### 8.2 단위 — 훅 (use<X>Chart)
- 각 훅: isVisible 토글, chart null 미생성, true→시리즈 생성(elderRay 2·squeeze 2·regression 1 addSeries), false→removeSeries, paneIndex 변경 시 재생성, setData(색 분기 인자 포함), 빈 배열→미호출, bars 변경 재싱크. (group-A에서 확립한 항목 망라)

### 8.3 레지스트리/라벨
- 레지스트리 32, 3종 category·kind·중복 없음.
- paneLabelUtils: 각 지표 활성 시 sub-label·색 정확(elderRay 2개).

### 8.4 E2E
- `chart-indicators.spec.ts` 확장: 모달에서 'Elder Ray'·'Squeeze'·'Regression' 각각 체크 → pane 지표이므로 `.pane-indicator-label` 노출 검증(MFI/ATR 패턴, exact 매처).

## 9. FSD 준수
- 훅·레지스트리·색·라벨·빌더·순수함수: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(ElderRayResult/SqueezeMomentumResult/RegressionResult/IndicatorResult). 레이어 정상. core 무변경.

## 10. 후속 (별도 스펙)
- C 전체 완료. 다음: 그룹 D(elderImpulse 캔들 색, smc zone primitive), 전송 페이로드 슬림화.
