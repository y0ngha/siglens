# 미사용 보조지표 렌더링 — 4차: 그룹 A-밴드 (Keltner·Donchian 가격 오버레이)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-group-a-bands` (base: `feat/render-group-c-simple` = PR #580)

## 1. 배경

미사용 보조지표 렌더링 4차. group-B(#577, bounded pane 7종)·group-C-simple(#580, unbounded pane 6종)에 이어, **가격 오버레이(Pane 0 겹침) 채널 2종**(Keltner·Donchian)을 추가한다. pane 지표와 달리 가격 차트 위에 직접 그려지며, `useBollingerOverlay`/`useMAOverlay`의 overlay 메커니즘을 재사용한다(`useIndicatorVisibility`·paneIndex 무관).

계산은 `@y0ngha/siglens-core`에 있으므로 추가 작업은 siglens 차트 렌더링뿐.

## 2. 자료조사 / 이미지 확인 결과

웹 자료조사(TradingView·StockCharts·Alchemy 등) + 이미지 확인으로 표준 렌더 방식을 확정:

- **Keltner Channel** `{upper, middle, lower}`: middle=EMA, upper/lower=EMA±ATR×배수. **부드러운 곡선 3선** — bollinger와 시각적으로 동일(부드러운 envelope).
- **Donchian Channel** `{upper, middle, lower}`: upper=N기간 최고가, lower=N기간 최저가, middle=중앙값. **계단형(step line) 3선** — 평평하다 새 고/저점에 점프하는 계단 모양이 표준(이미지 확인). 중간선은 통상 점선. 옅은 밴드 채움.

→ **핵심 렌더 차이**: donchian만 `lineType: LineType.WithSteps`(계단형), keltner는 기본 곡선. 둘 다 bollinger의 3시리즈(upper/middle/lower) 구조를 그대로 복제.

## 3. 목표 / 비목표

### 목표
- Keltner·Donchian 채널을 가격 오버레이로 렌더(useBollingerOverlay 패턴 복제).
- donchian은 계단형(WithSteps) + 점선 middle로 표준 모양 구현.
- 레지스트리 kind:`'overlay'` 메타 추가 → 모달 자동 노출, OverlayLegend에 crosshair 값 표시.

### 비목표 (별도 스펙)
- 그룹 A 나머지 3종: supertrend(trend 색 라인)·chandelierExit(stop 라인+trend)·parabolicSar(점 마커) — trend 방향 처리·마커 렌더 별도.
- C-복합 3종(elderRay·squeezeMomentum·regression), 그룹 D(elderImpulse·smc).

## 4. 핵심 결정사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 1차 범위 | A-밴드 2종(keltner·donchian) | bollinger 3밴드 복제로 가장 쉬움 (사용자 선택) |
| 훅 구조 | useBollingerOverlay 복제 (overlay, 자체 isVisible/toggle) | overlay는 pane과 메커니즘 다름; bollinger가 검증된 레퍼런스 |
| keltner 렌더 | 곡선 3선 (upper Area + middle Line + lower Area) | bollinger와 동일 시각 |
| donchian 렌더 | 3시리즈 `lineType: WithSteps` + middle 점선 | N기간 최고/최저라 계단형이 표준(이미지 확인) |
| 카테고리 | 둘 다 `volatility` | 채널/변동성 지표 |
| 데이터 추출 | `buildSeriesData(bars, <channelArray>, 'upper'\|'middle'\|'lower')` 재사용 | keltner/donchian이 bollinger와 동일 `{upper,middle,lower}` 구조 |

## 5. 아키텍처 (overlay 메커니즘 — pane 아님)

### 5.1 2 overlay 훅
**`hooks/useKeltnerOverlay.ts`** — `useBollingerOverlay` 복제:
- 3 시리즈: upper(`AreaSeries`, 채움색=keltnerBackground, lineColor=keltnerUpper), middle(`LineSeries`, keltnerMiddle), lower(`AreaSeries`, lineColor=keltnerLower).
- 데이터: `buildSeriesData(bars, indicators.keltnerChannel, 'upper'|'middle'|'lower')`.
- 자체 `useState(isVisible)` + `toggle` 반환.

**`hooks/useDonchianOverlay.ts`** — keltner 복제 + 계단형:
- 3 시리즈 모두 `lineType: LineType.WithSteps`. middle은 `lineStyle: LineStyle.Dashed`.
- 데이터: `buildSeriesData(bars, indicators.donchianChannel, ...)`.

### 5.2 레지스트리 (`model/indicatorRegistry.ts`)
- `IndicatorKey` union +2 (`keltnerChannel`·`donchianChannel`).
- `INDICATOR_REGISTRY` +2: `{ key:'keltnerChannel', label:'Keltner', category:'volatility', kind:'overlay' }`, `{ key:'donchianChannel', label:'Donchian', category:'volatility', kind:'overlay' }`.
- 카테고리 union·CATEGORY_LABELS 무변경.
- **paneIndex 무관**: `useIndicatorVisibility`는 kind:'pane'만 추리므로 overlay 키는 자동 제외 — 무변경 확인.

### 5.3 색상 (`shared/lib/chartColors.ts`)
- keltner: keltnerUpper/keltnerMiddle/keltnerLower/keltnerBackground.
- donchian: donchianUpper/donchianMiddle/donchianLower/donchianBackground.
- bollinger 색(#818cf8 계열)·기존 팔레트와 **라인색 중복 회피**(구현 시 grep 검증).

### 5.4 OverlayLegend (`utils/overlayLabelUtils.ts`)
- `buildOverlayLabelConfigs` params에 `keltnerVisible`·`donchianVisible` 추가.
- KC Upper/Middle/Lower, DC Upper/Middle/Lower config (`getValue: ind.keltnerChannel[i]?.upper ?? null` 등).

### 5.5 StockChart (`StockChart.tsx`)
- `useKeltnerOverlay`·`useDonchianOverlay` 호출 → `{ isVisible, toggle }`.
- `buildOverlayLabelConfigs` 호출에 keltnerVisible/donchianVisible 전달 + deps.
- `indicatorBindings`에 2 overlay binding 추가(24→26): `{ meta: INDICATOR_META.keltnerChannel, active: keltnerVisible, onToggle: toggleKeltner }`.

## 6. 데이터 흐름
```
indicatorRegistry (keltnerChannel·donchianChannel = kind:'overlay')
        │
StockChart: useKeltnerOverlay/useDonchianOverlay (자체 visible state) 호출
        │
binding 조립(26개) → IndicatorSettingsModal 자동 노출(무수정)
        │
체크 → toggle → 훅이 Pane 0에 3시리즈 생성/제거
        │
OverlayLegend: crosshair 시 KC/DC upper/middle/lower 값 표시
```

## 7. 테스트 전략 (vitest + RTL, 커버리지 90%+, happy + worst)

### 7.1 단위
- **useKeltnerOverlay·useDonchianOverlay**: bollinger 훅 테스트 복제 — 3 시리즈 생성(isVisible)/제거(toggle off), 데이터 세팅, **worst-case**(빈 배열 → setData 미호출). donchian은 `addSeries` 옵션에 `lineType: WithSteps` 포함 검증.
- **레지스트리**: 26개 등록, keltner/donchian이 kind:'overlay'·category:'volatility', 키 중복 없음.
- **overlayLabelUtils**: keltnerVisible/donchianVisible 시 KC/DC 6개 config 생성, getValue 정확.

### 7.2 통합 / E2E
- E2E(`chart-indicators.spec.ts` 확장): 모달에서 Keltner 체크 → OverlayLegend 또는 차트 반영 확인. (overlay는 pane label이 아니라 OverlayLegend — 셀렉터는 기존 overlay E2E 패턴 따름. 없으면 모달 체크 상태로 검증.)

### 7.3 회귀
- 기존 overlay 훅(bollinger/MA/EMA/ichimoku/VP)·pane 훅·`useIndicatorVisibility` 무변경. StockChart binding 추가(24→26) + overlayLabelConfigs params 확장으로 인한 기존 테스트(data-count) 갱신.

## 8. 확장성 검증
- supertrend/chandelier/parabolicSar(그룹 A 나머지) 추가 시: overlay 훅 + 레지스트리 + binding. 단 trend 색·마커는 새 설계.

## 9. FSD 준수
- 훅·레지스트리·색·legend: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(IndicatorResult). 레이어 정상. core 무변경.

## 10. 후속 (별도 스펙)
- 그룹 A 나머지 3종(supertrend·chandelier·parabolicSar — trend/마커)
- C-복합 3종, 그룹 D(elderImpulse·smc), 전송 페이로드 슬림화
