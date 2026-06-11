# 미사용 보조지표 렌더링 — 2차: 그룹 C-단순 (unbounded 단일-라인 pane 6종)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-group-c-simple` (base: `feat/render-unused-indicators` = PR #577, group-B 완료)

## 1. 배경

`IndicatorResult`의 미사용 지표 렌더링 2차. 1차(group-B, PR #577)에서 bounded 오실레이터 7종을 pane으로 렌더하고 `useIndicatorVisibility`를 레지스트리 기반 N-pane으로 일반화했다. 본 작업은 **unbounded 단일-라인 pane 6종**(그룹 C 중 단순 부류)을 추가한다.

계산은 이미 `@y0ngha/siglens-core`에 있으므로 추가 작업은 siglens 차트 렌더링뿐. paneIndex 일반화·레지스트리·모달·binding 인프라는 #577에서 완성됐다.

## 2. 목표 / 비목표

### 목표
- unbounded 단일-라인 pane 6종(`atr`·`obv`·`macdV`·`forceIndex`·`yangZhang`·`ewmaVolatility`)을 group-B와 동일한 pane 훅 패턴으로 렌더.
- 레지스트리·모달·paneIndex 일반화 인프라 재사용(무변경) — 레지스트리 메타 추가만으로 모달 자동 노출.

### 비목표 (별도 스펙)
- **C-복합 3종**: `elderRay`(히스토그램 2개), `squeezeMomentum`(히스토그램+상태 마커), `regression`(slope/r2 2값) — 새 렌더 메커니즘 필요.
- 그룹 A(가격 오버레이 5종), 그룹 D(특수: elderImpulse·smc).
- 전송 페이로드 슬림화(메모리 `project_indicator_payload_waste`).

## 3. 핵심 결정사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 1차 범위 | C-단순 6종만 | RSI/group-B 복제로 가장 빠름·검증된 패턴 (사용자 선택) |
| 훅 구조 | RSI/group-B 훅 복제 (개별 파일 6개) | 기존 pane 훅 패턴과 완전 일관 |
| 기준선 | macdV·forceIndex만 0선, 4종 무기준선 | atr/obv/yangZhang/ewma는 양수 변동성·누적이라 over/under 개념 없음 |
| 카테고리 | 기존 카테고리 재사용(신규 없음) | momentum/volume/volatility로 충분 |
| paneIndex·모달 | #577 인프라 무변경 | 레지스트리 추가만으로 자동 배정·노출 |

## 4. 데이터 형태 / 카테고리 / 기준선

6종 모두 `IndicatorResult`에서 `(number | null)[]` (bar당 1값, warm-up은 null).

| key | label | category | 기준선 | 상수 출처 |
|---|---|---|---|---|
| `macdV` | MACD-V | momentum | 0 (zero line) | chart 표시 상수 `MACD_V_ZERO_LEVEL = 0` |
| `forceIndex` | Force Index | momentum | 0 (zero line) | chart 표시 상수 `FORCE_INDEX_ZERO_LEVEL = 0` |
| `obv` | OBV | volume | 없음 | — |
| `atr` | ATR | volatility | 없음 | — |
| `yangZhang` | Yang-Zhang | volatility | 없음 | — |
| `ewmaVolatility` | EWMA Vol | volatility | 없음 | — |

> 0선 상수 2개는 시각화 임계라 `widgets/chart/constants/indicatorLevels.ts`에 로컬 정의(group-B의 williamsR·hurst 등과 동일 방침). atr/obv/yangZhang/ewmaVolatility는 기준선 없음 → 해당 훅은 `createPriceLine` 생략.

## 5. 아키텍처 (group-B와 동일 메커니즘)

### 5.1 6 pane 훅 (`hooks/useMacdVChart.ts` 등 — RSI 복제)
각 훅은 `useRSIChart`/group-B 훅과 동일 구조(2 effects: 시리즈 lifecycle + 데이터 sync; 동일 ref/useEffectEvent 패턴). 차이:
- 색: `CHART_COLORS.<key>Line`
- 기준선: macdV·forceIndex는 `createPriceLine(0선)` 1개; 나머지 4종은 createPriceLine 없음
- dataAccessor: `indicators.<key>` (단일 배열) → `buildSeriesDataFromValues(bars, <key>)`

### 5.2 레지스트리 확장 (`model/indicatorRegistry.ts`)
- `IndicatorKey` union에 6키 추가(`macdV`·`forceIndex`·`obv`·`atr`·`yangZhang`·`ewmaVolatility`).
- `INDICATOR_REGISTRY`에 6 메타 추가(§4 표, 전부 `kind: 'pane'`).
- `IndicatorCategory`·`CATEGORY_LABELS` 무변경(기존 momentum/volume/volatility 재사용).

### 5.3 상수 + 색상
- `constants/indicatorLevels.ts`: `MACD_V_ZERO_LEVEL = 0`, `FORCE_INDEX_ZERO_LEVEL = 0` 추가.
- `shared/lib/chartColors.ts`: 6종 라인색 + 0선 색(zero) 추가. 기존·group-B 색과 **중복 회피**(구현 시 검증).

### 5.4 pane label / StockChart
- `paneLabelUtils.ts`: `buildSinglePaneLabel`(기존 헬퍼)로 6종 label 추가(MACD-V·Force Index·OBV·ATR·Yang-Zhang·EWMA Vol).
- `StockChart.tsx`: 6 훅 호출 + binding **18→24**. `useIndicatorVisibility`(레지스트리 기반)·모달 무변경.

## 6. 데이터 흐름 (#577과 동일)
```
indicatorRegistry (pane 키 = kind:'pane', 이제 19종)
        │
useIndicatorVisibility: 레지스트리 전체 키 visible Record + 동적 paneIndex (무변경)
        │
StockChart: 6 신규 pane 훅 호출 + binding 조립(24개)
        │
IndicatorSettingsModal: 카테고리 그룹핑 자동 노출 (무수정)
        │
체크 → toggle(key) → paneIndices 재계산 → 훅이 pane 생성/제거
```

## 7. 테스트 전략 (vitest + RTL, 커버리지 90%+, happy + worst)

### 7.1 단위
- **6 pane 훅** 각각: 시리즈 생성(visible)/제거(false), paneIndex 변경 재생성, 데이터 세팅, **worst-case**(빈 배열·전부 null). macdV/forceIndex는 0선 priceLine 생성 확인.
- **레지스트리**: 24개 등록, 6 신규 키 카테고리·pane kind, 키 중복 없음.
- **상수**: `MACD_V_ZERO_LEVEL`·`FORCE_INDEX_ZERO_LEVEL` 값 단언.

### 7.2 통합 / E2E
- E2E(`chart-indicators.spec.ts` 확장): 모달에서 ATR(또는 macdV) 체크 → pane label 차트 반영(`.pane-indicator-label` 스코프 — #577 교훈).

### 7.3 회귀
- 기존 pane 훅(group-B 7 + 기존 6)·`useIndicatorVisibility`는 코드 무변경. StockChart binding 추가로 인한 기존 테스트(StockChart.test data-count 18→24) mock·단언 갱신.

## 8. 확장성 검증
- C-복합 3종·그룹 A·D 추가 시: 레지스트리 메타 + 훅 + StockChart binding만. paneIndex 일반화·모달 무수정.

## 9. FSD 준수
- 훅·레지스트리·상수: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(IndicatorResult). 레이어 방향 정상. core 무변경.

## 10. 후속 (별도 스펙)
- C-복합 3종(elderRay 히스토그램·squeezeMomentum 히스토+상태·regression 2값)
- 그룹 A(가격 오버레이 5종), 그룹 D(elderImpulse 캔들 색칠·smc zone primitive)
- 전송 페이로드 슬림화
