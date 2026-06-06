# 미사용 보조지표 렌더링 — 1차: paneIndex 일반화 + 그룹 B (bounded 오실레이터)

- **작성일**: 2026-06-06
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-unused-indicators` (base: `feat/indicator-settings-modal` = PR #575)
- **선행 의존**: PR #575(indicator-settings-modal)의 레지스트리·모달·binding 구조

## 1. 배경 / 문제

`IndicatorResult`(@y0ngha/siglens-core)는 30+개 지표를 모두 계산해 내려주지만, 차트는 그중 12개만 렌더한다(PR #575 기준). 나머지 ~18개(스펙 `2026-06-06-indicator-settings-modal-design.md` §3.1)는 미사용이다. 본 작업은 그 첫 단계로 **bounded 오실레이터 7종(그룹 B)**을 pane으로 렌더한다.

계산은 이미 core에 있으므로 추가 작업은 순수 **siglens 차트 렌더링(시각화)**이다. core 변경 없음.

### 선행 과제: paneIndex 일반화
현재 `useIndicatorVisibility`는 RSI~CCI **6개 pane을 하드코딩**(개별 `useState` + 6키 `paneIndices` 객체)한다. pane 지표를 추가하려면 이 로직을 **레지스트리 기반 N개**로 일반화해야 한다. 이것이 그룹 B(및 향후 그룹 C) 렌더의 전제다.

## 2. 목표 / 비목표

### 목표
- `useIndicatorVisibility`를 레지스트리(`kind === 'pane'`) 기반으로 일반화 — pane 지표 추가 시 paneIndex 배정이 자동 확장.
- bounded 오실레이터 7종(mfi·williamsR·connorsRsi·cmf·bollingerDerived %B·hurst·varianceRatio)을 pane으로 렌더.
- 신규 카테고리 `statistical`('통계') 추가(hurst·varianceRatio).
- 모달·`groupBindingsByCategory` 무수정으로 7종 자동 노출 → PR #575 확장성 설계의 실증.

### 비목표 (이번 스펙 제외)
- 그룹 A(가격 오버레이 5종), 그룹 C(unbounded pane 9종), 그룹 D(특수: elderImpulse·smc) — 후속 스펙.
- 지표 전송 페이로드 슬림화(메모리 `project_indicator_payload_waste`) — 별도.
- 기존 6개 pane 훅의 공통화/리팩토링 — 회귀 위험 회피 위해 불변 유지.

## 3. 핵심 결정사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 1차 범위 | paneIndex 일반화 + 그룹 B 7종 | RSI 훅 복제로 가장 쉬움, 일반화 검증에 최적 (사용자 선택) |
| pane 훅 구조 | RSI 훅 복제 7개 (개별 파일) | 기존 6개 pane 훅 패턴과 완전 일관 (사용자 선택) |
| visible state | `Record<paneKey, boolean>` 단일 state | 13개 개별 useState 회피, 레지스트리 확장 대응 |
| paneIndex 배정 | 레지스트리 pane 순서대로 활성 지표에 1,2,3… 동적 압축 | 기존 로직의 일반화 |
| 기존 6개 pane 훅 | 불변 (`paneIndices.rsi`는 Record에서 그대로 동작) | 회귀 위험 0 |
| 기준선 상수 | core 상수 활용 + 없는 것은 siglens chart 표시 상수 | 표시 임계는 시각화 영역(도메인 아님) |

## 4. 그룹 B 7종 — 데이터 형태 / 카테고리 / 기준선

| key | label | category | 데이터 (IndicatorResult) | 기준선 | 상수 출처 |
|---|---|---|---|---|---|
| `mfi` | MFI | momentum | `mfi: (number\|null)[]` | 80 / 20 | core `MFI_OVERBOUGHT_LEVEL`/`MFI_OVERSOLD_LEVEL` |
| `williamsR` | Williams %R | momentum | `williamsR: (number\|null)[]` | -20 / -80 | siglens chart 상수 (core 없음) |
| `connorsRsi` | CRSI | momentum | `connorsRsi: (number\|null)[]` | 90 / 10 | core `CRSI_OVERBOUGHT`/`CRSI_OVERSOLD` |
| `cmf` | CMF | momentum | `cmf: (number\|null)[]` | 0 (zero line) | core `CMF_BULLISH_CROSS_LEVEL` (=0) |
| `bollingerPercentB` | %B | volatility | `bollingerDerived: {pctB,bandwidth}[]` → `pctB` 추출 | 1 / 0 | siglens chart 상수 |
| `hurst` | Hurst | statistical | `hurst: (number\|null)[]` | 0.5 (random-walk) | siglens chart 상수 |
| `varianceRatio` | VR | statistical | `varianceRatio: (number\|null)[]` | 1.0 (random-walk) | siglens chart 상수 |

> `bollingerDerived.pctB`는 `number | null`(zero-width band 시 null). dataAccessor에서 `d => d.pctB` 추출, null은 기존 `buildSeriesDataFromValues`의 null 처리 흐름을 그대로 탄다.

## 5. 아키텍처

### 5.1 `useIndicatorVisibility` 일반화 (`hooks/useIndicatorVisibility.ts` 재작성)
```ts
// pane 지표 키: 레지스트리에서 kind === 'pane' 필터 (등록 순서 유지)
const PANE_KEYS: readonly IndicatorKey[] =
    INDICATOR_REGISTRY.filter(m => m.kind === 'pane').map(m => m.key);

// 단일 state: 각 pane 키의 visible 여부
const [visible, setVisible] = useState<Record<IndicatorKey, boolean>>(
    () => Object.fromEntries(PANE_KEYS.map(k => [k, false])) as ...
);

const toggle = useCallback((key: IndicatorKey) =>
    setVisible(prev => ({ ...prev, [key]: !prev[key] })), []);

// 활성 pane에 등록 순서대로 1,2,3… 배정, 비활성은 INACTIVE_PANE_INDEX
const paneIndices: Record<IndicatorKey, number> = useMemo(() => {
    let next = FIRST_INDICATOR_PANE_INDEX;
    return Object.fromEntries(
        PANE_KEYS.map(k => [k, visible[k] ? next++ : INACTIVE_PANE_INDEX])
    ) as ...;
}, [visible]);

return { visible, toggle, paneIndices };
```
- 반환 형태 변경: 기존 `{ rsiVisible, toggleRSI, ..., paneIndices }` → `{ visible, toggle, paneIndices }`.
- `paneIndices`는 `Record<IndicatorKey, number>` — 기존 훅의 `paneIndices.rsi` 접근 그대로 유효.
- `PaneIndices` 타입(`types.ts`)을 `Record<IndicatorKey, number>`로 확장(기존 6키 인터페이스 대체).

### 5.2 그룹 B 7개 pane 훅 (`hooks/useMfiChart.ts` 등 — RSI 복제)
각 훅은 `useRSIChart`와 동일 구조(`isVisible`, `paneIndex` prop, 시리즈 lifecycle effect + 데이터 sync effect). 차이는:
- 색: `CHART_COLORS.<key>Line` 등 신규 색 추가.
- 기준선: `createPriceLine`으로 overbought/oversold(또는 zero/level) — §4 기준선.
- dataAccessor: 6종은 `indicators.<key>`, %B는 `indicators.bollingerDerived.map(d => d.pctB)`.

### 5.3 레지스트리 확장 (`model/indicatorRegistry.ts`)
- `IndicatorKey` union에 7개 키 추가.
- `IndicatorCategory` union에 `'statistical'` 추가.
- `CATEGORY_LABELS`에 `statistical: '통계'` 추가(`CATEGORY_ORDER`는 keys 파생이라 자동, 'volume' 다음 등 위치는 라벨 정의 순서로 결정 — momentum/volatility 뒤, smc 앞 권장).
- `INDICATOR_REGISTRY`에 7개 메타 추가(§3 표).

### 5.4 StockChart binding 조립 확장 (`StockChart.tsx`)
- 7개 pane 훅 호출 추가: `useMfiChart({ ...commonHookParams, isVisible: visible.mfi, paneIndex: paneIndices.mfi })` 등.
- `useIndicatorVisibility` 반환 형태 변경에 맞춰 기존 6개 훅 호출도 `visible.rsi`/`paneIndices.rsi`로 갱신.
- `indicatorBindings` 배열에 7개 binding 추가(11→18): pane 지표는 `active: visible[key]`, `onToggle: () => toggle(key)`.
- `buildPaneLabels`(paneLabelUtils)에 7개 pane label 추가.

### 5.5 색상 상수 (`shared/lib/chartColors.ts`)
7종 라인 색 + core에 없는 기준선 색 추가. 기존 오실레이터 색 팔레트와 구분되는 semantic 토큰.

## 6. 데이터 흐름
```
indicatorRegistry (pane 키 = kind:'pane' 필터)
        │
useIndicatorVisibility: visible Record + paneIndices(활성 동적 배정)
        │
StockChart: 7개 pane 훅 호출(isVisible/paneIndex) + binding 조립(18개)
        │
IndicatorSettingsModal: 레지스트리 그룹핑 → 통계 카테고리 자동 노출 (무수정)
        │
체크 → toggle(key) → visible 갱신 → paneIndices 재계산 → 훅이 pane 생성/제거
```

## 7. 테스트 전략 (vitest + RTL, 커버리지 90%+, happy + worst)

### 7.1 단위
- **7개 pane 훅** 각각: 시리즈 생성(isVisible true), 제거(false), paneIndex 변경 시 재생성, 데이터 세팅, **worst-case**(빈 배열, 전부 null, %B의 null pctB).
- **`useIndicatorVisibility` 일반화**: 일부만 켜면 paneIndex 압축 배정(예: rsi+mfi+hurst → 1,2,3), 전부 끄면 전부 INACTIVE, toggle 토글, 13키 전부 존재.
- **레지스트리**: 18개 등록, `statistical` 카테고리 라벨, 키 중복 없음, `groupBindingsByCategory`에 통계 그룹 포함·순서.

### 7.2 통합 / E2E
- 모달 통합 테스트(기존 chartIndicatorFlow): 통계 카테고리 + MFI 체크박스 렌더 확인.
- E2E(`chart-indicators.spec.ts` 확장 또는 신규): `/AAPL` → 모달 → '통계' 카테고리 표시, MFI 체크 → pane label('MFI') 차트 반영 확인. (셀렉터 strict-mode 주의 — exact 매칭.)

### 7.3 회귀
- 기존 6개 pane 훅은 코드 불변. `useIndicatorVisibility` 반환 형태 변경으로 인한 StockChart·기존 테스트(StockChart.test.tsx, worst-case 2개) mock 갱신 필요 — paneIndices/visible 형태에 맞춤.

## 8. 확장성 검증 (수용 기준)
- 그룹 C(unbounded pane) 추가 시: 레지스트리 메타 + 훅 + StockChart 호출/binding만. `useIndicatorVisibility`·모달 무수정(paneIndex 자동 배정).
- 신규 카테고리(이번 `statistical`)가 union+라벨 추가만으로 모달에 노출됨을 실증.

## 9. FSD 준수
- 훅·레지스트리·색상: `widgets/chart` 내부 + `shared/lib/chartColors`. core 직접 import(상수). 레이어 방향 정상.
- core 무변경(계산은 이미 존재).

## 10. 리스크
- `useIndicatorVisibility` 반환 형태 변경이 기존 소비자(StockChart + 테스트 mock)에 파급. 6개 pane 훅 자체는 무수정이나 호출부(prop 전달)는 갱신 필요 — 회귀 테스트로 커버.
- pane 13개 동시 활성 시 차트 세로 공간 부족 가능 — 본 스펙은 토글 UI만 제공(동시 다수 활성은 사용자 선택), 레이아웃 제약은 비목표.
