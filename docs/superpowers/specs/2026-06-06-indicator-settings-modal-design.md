# 보조지표 설정 모달 재설계 (IndicatorToolbar → IndicatorSettingsModal)

- **작성일**: 2026-06-06
- **상태**: 설계 승인됨, 구현 계획 대기
- **범위**: `widgets/chart` UI 재설계 (순수 툴바 재설계, 새 지표 추가 0개)

## 1. 배경 / 문제

현재 차트의 보조지표 토글 UI(`widgets/chart/IndicatorToolbar.tsx`)는 차트 **좌상단**에 평평한 버튼을 나열하는 구조다. 두 가지 한계가 있다.

1. **확장 불가**: `IndicatorToolbar`가 15개의 props(`bollinger`, `macd`, `rsi`, … period 관련 6개)를 개별로 받는다. 향후 미사용 지표(현재 `IndicatorResult` 30개 필드 중 차트 미사용 ~18개)를 차트에 추가하려면 props가 폭발한다.
2. **UI 한계**: 카테고리 없이 버튼을 평평하게 나열해, 지표가 늘어나면 좌상단 영역이 감당하지 못한다.

`IndicatorResult`는 `@y0ngha/siglens-core`에서 이미 30+개 지표를 모두 계산해 내려준다. 즉 추가 작업은 순수하게 **siglens 쪽 차트 렌더링(시각화)**이며 core 변경은 불필요하다.

## 2. 목표 / 비목표

### 목표
- 차트 **우상단**에 톱니바퀴(설정) 버튼을 두고, 클릭 시 **중앙 모달**에서 보조지표를 카테고리별 체크박스로 토글.
- 지표를 **선언적 레지스트리**로 정의해 향후 23개 미사용 지표를 한 줄 추가로 수용 가능한 구조 확보.
- 기존 11개 토글 지표를 카테고리(추세/모멘텀/변동성/볼륨/SMC)로 재배치. 빈 카테고리는 숨김.

> **재설계의 본래 동기**: 평평한 버튼 나열을 모달로 바꾸는 이유는 단순 UI 개선이 아니라, **곧 차트에 추가될 미사용 23개 지표를 수용**하기 위함이다. 따라서 "11개를 모달로 옮긴다"가 아니라 "23개를 담을 그릇을 11개로 검증한다"가 본 스펙의 관점이다. 23개 수용 가능성은 §3.1·§8의 **1급 설계 제약**으로 검증한다.

### 비목표 (이번 스펙에서 제외)
- **새 지표 추가 0개**. 미사용 18개의 차트 렌더링 구현은 후속 작업.
- **전송 페이로드 최적화 제외**. `getBarsAction`이 클라로 보내는 미사용 지표 trim은 별도 스펙으로 분리(메모리 `project_indicator_payload_waste`). 동적 `getIndicatorsAction`은 캐시 키 폭발로 비채택.
- **`buySellVolume` 토글화 제외**. `VolumeChart`에서 항상 표시(토글 UI 없음) 동작을 유지.
- **공통 `ModalShell` 추출 제외**. 레포에 모달이 4곳 복붙(`ContactDialog` 등) 중이라 추출 여지는 있으나, 이번 재설계와 무관한 리팩토링이라 제외.

## 3. 핵심 결정사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 패널 형태 | 중앙 모달(Modal) | 23개 지표를 넓게 펼쳐 보기 좋음 (사용자 선택) |
| 설계 접근 | B — 레지스트리 중심 | props 폭발 해소 + 기존 훅 불변으로 회귀 위험 낮음 |
| MA/EMA period | 행 확장 + period 칩 | 기존 다중 period 기능 100% 유지 |
| period 칩 색상 | `getPeriodColor(period)` 재사용 | 차트 라인 색과 일치, 일관성 유지 |
| 모달 인프라 | `shared/hooks/useDialog()` 재사용 | 레포 확립된 패턴(`ContactDialog`). focus trap·Esc·click-outside·트리거 포커스 복원 제공. 범용 `Modal` 컴포넌트는 레포에 없음 |
| 작업 범위 | 순수 툴바 재설계 | 사용자 선택 |

## 3.1 향후 수용할 23개 지표 매핑 (1급 설계 제약)

레지스트리 메타 스키마가 23개 전부를 표현할 수 있는지 사전 검증한다. (데이터 형태는 첫 조사 결과 기준.)

| 카테고리 | 미사용 지표 (kind) |
|---|---|
| 추세 (trend) | supertrend(overlay), parabolicSar(overlay) |
| 변동성 (volatility) | keltnerChannel·donchianChannel·chandelierExit(overlay), atr·yangZhang·ewmaVolatility·bollingerDerived(pane) |
| 모멘텀 (momentum) | williamsR·mfi·cmf·connorsRsi·macdV·squeezeMomentum·forceIndex·elderRay(pane) |
| 볼륨 (volume) | obv(pane) |
| 통계 (statistical, 신규 카테고리 후보) | hurst·varianceRatio·regression(pane) |
| SMC (smc) | smc(zone) |
| 특수 | elderImpulse(candle-paint) |

### 스키마 충분성 검증
- **`kind` union 확장 필요**: 현재 11개는 `'overlay' | 'pane'`로 충분하나, 미래엔 `'candle-paint'`(elderImpulse: 캔들 per-bar 색칠)와 `'zone'`(smc: 박스 primitive)이 추가된다. → `kind`는 union 확장만으로 흡수(레지스트리 한 줄).
- **모달은 `kind`에 무관**: `kind`는 **차트 렌더 훅 분기/문서화용**이며, 모달 UI는 모든 지표를 동일하게 "체크박스 + 선택적 period 칩"으로만 다룬다. → `kind`가 어떻게 확장돼도 **`IndicatorSettingsModal`은 무수정**. 이것이 본 구조의 확장성 핵심 증거.
- **`hasPeriods`**: 미래 23개 중 다중 period 선택이 필요한 지표는 없음(supertrend 등은 단일 파라미터 고정). MA/EMA만 `true` 유지.
- **카테고리 추가**: `statistical` 등 신규 카테고리는 `IndicatorCategory` union + `CATEGORY_ORDER`/`CATEGORY_LABELS`에 추가하면 끝. 모달은 `CATEGORY_ORDER`를 순회하므로 무수정.
- **paneIndex 배정의 한계(후속 과제)**: 현재 `useIndicatorVisibility`는 6개 pane(rsi~cci)을 **하드코딩**해 paneIndex를 동적 압축한다. pane 지표가 늘면 이 로직을 레지스트리 기반으로 일반화해야 한다. **이번 스펙에서는 건드리지 않되**(11개 그대로), 후속 지표 추가 스펙에서 일반화한다(§10). 본 스펙의 레지스트리/binding 구조는 그 일반화를 막지 않는다.

## 4. 카테고리 분류 (모달 대상 11개)

| 카테고리 | 지표 | kind |
|---|---|---|
| 추세 (trend) | MA, EMA, Ichimoku | overlay |
| 모멘텀 (momentum) | RSI, MACD, DMI, Stochastic, StochRSI, CCI | pane |
| 변동성 (volatility) | Bollinger | overlay |
| 볼륨 (volume) | VolumeProfile | overlay |
| SMC (smc) | (없음 → 숨김) | — |

> Bollinger는 통상 변동성 밴드라 추세가 아닌 변동성에 배치. `buySellVolume`은 토글 대상이 아니므로 제외 → 모달 대상은 11개.

## 5. 아키텍처

### 5.1 레지스트리 (정적 메타)
`widgets/chart/model/indicatorRegistry.ts` (신규)

```ts
type IndicatorCategory = 'trend' | 'momentum' | 'volatility' | 'volume' | 'smc';
type IndicatorKind = 'overlay' | 'pane';

interface IndicatorMeta {
  key: string;            // 'ma' | 'rsi' | ...
  label: string;          // 'MA' | 'RSI'
  category: IndicatorCategory;
  kind: IndicatorKind;
  hasPeriods?: boolean;   // MA/EMA만 true
}

// + 카테고리 표시 순서 / 한글 라벨 맵
const CATEGORY_ORDER: readonly IndicatorCategory[] = [...];
const CATEGORY_LABELS: Record<IndicatorCategory, string> = {...};
```

**새 지표 추가 = 이 배열에 한 줄.**

### 5.2 binding 조립 (StockChart)
기존 11개 훅은 **그대로 둠**(회귀 위험 0). 각 훅의 `visible/toggle`을 레지스트리 메타와 합쳐 항목 배열 하나로 만든다.

```ts
interface IndicatorBinding {
  meta: IndicatorMeta;
  active: boolean;
  onToggle?: () => void;                  // 단순 토글 (pane + bollinger/ichimoku/vp)
  availablePeriods?: readonly number[];   // period 지표 (ma/ema)
  visiblePeriods?: number[];
  onTogglePeriod?: (p: number) => void;
}
```

`StockChart`가 `bindings: IndicatorBinding[]`를 조립해 모달에 전달 → **props 폭발 없음**.

### 5.3 모달 컴포넌트
`widgets/chart/ui/IndicatorSettingsModal.tsx` (신규)
- `useDialog()` 재사용. 톱니바퀴 트리거 버튼(차트 우상단 `absolute top-2 right-2`).
- 마크업은 `ContactDialog` 패턴(`fixed inset-0` 오버레이 + `role="dialog"` 카드) 차용.
- `bindings`를 `CATEGORY_ORDER` 순서로 그룹핑 렌더. **해당 카테고리 binding이 0개면 그룹 자체를 스킵**(SMC 자동 숨김).
- period 지표(`hasPeriods`)는 체크 시 그 아래 period 칩(`getPeriodColor` 색 점 + 숫자)이 인라인으로 펼쳐짐.

### 5.4 데이터 흐름
```
indicatorRegistry (정적 메타)
        │
StockChart: 기존 훅 호출 → IndicatorBinding[] 조립
        │
IndicatorSettingsModal: 카테고리 그룹핑 → 체크박스 / period 칩 렌더
        │
체크 → binding.onToggle / onTogglePeriod → 기존 훅 state 갱신 → 차트 반영
```

## 6. 파일 변경 목록

**신규**
- `widgets/chart/model/indicatorRegistry.ts` — 정적 메타 + 카테고리 순서/라벨
- `widgets/chart/model/types.ts` (또는 기존 `types.ts`에 추가) — `IndicatorMeta`, `IndicatorBinding`, `IndicatorCategory`, `IndicatorKind`
- `widgets/chart/ui/IndicatorSettingsModal.tsx` — 모달 + 톱니바퀴 트리거
- 위 각각의 colocated 테스트

**수정**
- `widgets/chart/StockChart.tsx` — 기존 훅 결과를 `IndicatorBinding[]`로 조립해 모달에 전달. 톱니바퀴를 `top-2 right-2`에 배치. `IndicatorToolbar` 사용 제거.
- E2E 스펙 (필요 시 수정 — 6.2 참조)

**삭제**
- `widgets/chart/IndicatorToolbar.tsx`
- `widgets/chart/hooks/useIndicatorDropdown.ts` (모달이 흡수). + colocated 테스트 정리

**불변 유지 (회귀 위험 0)**
- `useIndicatorVisibility`(paneIndex 동적 배정), 11개 개별 지표 훅, `getPeriodColor`, `OverlayLegend`(좌상단 유지), `VolumeChart`/`buySellVolume`

## 7. 테스트 전략

### 7.1 단위 / 컴포넌트 (vitest + RTL, 커버리지 90%+, happy + worst case)
- **레지스트리**: 카테고리 그룹핑 결과, 빈 카테고리(SMC) 제외, 메타 무결성(중복 key 없음, kind 일관성).
- **모달**:
  - happy: 카테고리별 체크박스 렌더, 체크 토글 시 `binding.onToggle` 호출, period 칩 토글 시 `onTogglePeriod(period)` 호출, 활성 상태 반영.
  - worst case: bindings 빈 배열(전 카테고리 0개), period 지표인데 `visiblePeriods` 비어있음/전부 선택, `onToggle` 미정의(period 전용 항목), 모달 열림/닫힘(Esc·오버레이 클릭·트리거 포커스 복원), focus trap, 빠른 연속 토글.
- **StockChart binding 조립**: 11개 훅 결과가 올바른 `IndicatorBinding`으로 매핑되는지(특히 ma/ema의 period 필드).

### 7.2 E2E (Playwright — 필수)
기존 스위트(메모리 `project_e2e_suite_landed`)에 차트 지표 모달 시나리오 추가/수정:
- 종목 페이지 진입 → 톱니바퀴 클릭 → 모달 오픈 확인.
- 카테고리별 지표 체크 → 차트에 해당 pane/overlay가 실제로 나타나는지(예: RSI 체크 → RSI pane 생성).
- 체크 해제 → 사라짐. MA period 다중 선택 → 라인 개수 반영.
- Esc/오버레이 클릭으로 닫힘.
- 기존 IndicatorToolbar 기반 E2E 셀렉터가 있으면 새 모달 구조로 갱신.

## 8. 확장성 검증 (수용 기준)

새 지표 추가 시 변경점이 다음 3곳으로 한정되어야 한다:
1. `indicatorRegistry.ts`에 메타 한 줄.
2. 해당 지표 렌더 훅 작성(`useXxxChart`/`useXxxOverlay`) — 기존 패턴 복제.
3. `StockChart.tsx`에서 훅 호출 + `IndicatorBinding` 1개 조립.

→ `IndicatorSettingsModal`과 모달 props는 **무수정**.

추가로 §3.1의 검증에 따라:
- 새 `kind`(`candle-paint`/`zone`)나 새 카테고리(`statistical`) 추가 시에도 모달은 무수정.
- 단, pane 지표 추가 시 `useIndicatorVisibility`의 paneIndex 배정 일반화는 별도로 필요(§10).

이번 스펙의 11개는 이 수용 기준을 만족하는지 검증하는 **레퍼런스 구현**이다.

## 9. FSD 레이어 준수
- 레지스트리·모달은 `widgets/chart` 내부(`model/`, `ui/`).
- `shared/hooks/useDialog`, `shared/lib/chartColors`(`getPeriodColor`) 소비 — 하위 레이어 import로 적법.
- 기존 paneIndex 동적 배정 로직 유지.

## 10. 후속 (별도 스펙)

본 모달 재설계의 **목적지**다. 본 스펙은 이 후속들이 매끄럽게 진행되도록 그릇을 만드는 단계.

- **미사용 23개 지표 차트 렌더링** (핵심 후속): §3.1 매핑 기준으로 단계적 추가. 권장 순서 — 그룹 B(bounded 오실레이터: mfi/williamsR/connorsRsi/cmf/hurst/varianceRatio/%B, RSI 훅 복제로 가장 쉬움) → 그룹 A·C(채널/라인 오버레이·unbounded pane) → 그룹 D(elderImpulse 캔들 색칠, smc zone 박스 primitive). 추가 전 **`useIndicatorVisibility`의 paneIndex 배정을 레지스트리 기반으로 일반화**하는 선행 작업이 필요(현재 6개 하드코딩).
- **지표 전송 페이로드 슬림화**: 계산/캐시 전체 유지 + 클라 직렬화 경계에서 레지스트리 화이트리스트로 trim. 메모리 `project_indicator_payload_waste` 참조. 레지스트리(§5.1)가 "차트가 렌더하는 지표" 단일 출처가 되므로 이 화이트리스트와 자연히 연동된다.
