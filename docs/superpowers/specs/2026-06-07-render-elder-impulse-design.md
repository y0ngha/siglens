# 미사용 보조지표 렌더링 — 8차(그룹 D-1): elderImpulse (캔들 per-bar 색칠)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-elder-impulse` (base: `feat/render-c-complex` = PR #585)

## 1. 배경

미사용 보조지표 렌더링 8차. 그룹 D(elderImpulse·smc zone)는 렌더 메커니즘이 완전히 disjoint하여 **2개 PR로 분리**한다(사용자 선택). 이 스펙은 그 첫 번째 **elderImpulse**만 다룬다(smc zone은 별도 스펙/PR).

elderImpulse는 지금까지의 작업(별도 overlay/pane 시리즈 추가)과 달리 **기존 메인 캔들스틱 시리즈를 per-bar로 재색칠**하는 신규 메커니즘이다. Elder Impulse System: green=EMA↑ AND MACD 히스토그램↑(강세 모멘텀), red=둘 다↓(약세), blue=혼조(중립). 계산은 `@y0ngha/siglens-core`에 있어 추가 작업은 siglens 렌더링뿐.

## 2. 자료조사 / 렌더 표준

- **Elder Impulse System**: 가격 캔들 자체를 모멘텀에 따라 3색으로 칠한다(별도 패널/오버레이 아님). green=상승 모멘텀, red=하락 모멘텀, blue=중립/전환. core JSDoc과 일치.
- LWC `CandlestickData`는 per-point `color`·`borderColor`·`wickColor` 필드로 시리즈 기본 up/down 색을 override한다 → 메인 시리즈 데이터에 색을 주입하는 방식으로 구현.

데이터(siglens-core `domain/types.d.ts`):
```ts
type ImpulseColor = 'green' | 'red' | 'blue';
// IndicatorResult.elderImpulse: (ImpulseColor | null)[]  // 한 bar당 한 색, warm-up은 null
```

현재 메인 캔들 setData(StockChart.tsx):
```ts
seriesRef.current.setData(
    bars.map(({ time, open, high, low, close }) => ({ time: time as UTCTimestamp, open, high, low, close }))
);
```

## 3. 핵심 설계 결정

### 3.1 `buildCandlestickData` 순수 헬퍼 (침투 격리)
메인 캔들 effect의 인라인 map을 순수 헬퍼로 추출해, elderImpulse 색 주입 로직을 테스트 가능하게 격리한다:
```ts
// utils/candlestickDataUtils.ts
import type { Bar, ImpulseColor } from '@y0ngha/siglens-core';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

export function buildCandlestickData(
    bars: Bar[],
    elderImpulse: (ImpulseColor | null)[],
    isImpulseActive: boolean
): CandlestickData<UTCTimestamp>[] {
    return bars.map((bar, i) => {
        const base = {
            time: bar.time as UTCTimestamp,
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        };
        if (!isImpulseActive) return base;
        const impulse = elderImpulse[i];
        if (impulse == null) return base; // warm-up: 기본 bull/bear 색 유지
        const color = impulseColor(impulse);
        return { ...base, color, borderColor: color, wickColor: color };
    });
}
```
- `isImpulseActive=false`(토글 off) 또는 `elderImpulse[i]`가 null(warm-up)이면 plain OHLC → 시리즈 기본 bull/bear 색 적용(자동 복원).
- 활성 + 색 있으면 body/border/wick 모두 impulse 색으로 통일.

### 3.2 `impulseColor` 순수 함수 (`utils/candlestickDataUtils.ts` 동거)
```ts
export function impulseColor(c: ImpulseColor): string {
    if (c === 'green') return CHART_COLORS.impulseBullish;
    if (c === 'red') return CHART_COLORS.impulseBearish;
    return CHART_COLORS.impulseNeutral; // 'blue'
}
```

### 3.3 색상 (`shared/lib/chartColors.ts` + `globals.css`)
DESIGN.md 추세 고정값 + Elder blue 관례:
```ts
impulseBullish: '#26a69a', // green — EMA↑ & MACD-hist↑
impulseBearish: '#ef5350', // red — 둘 다 ↓
impulseNeutral: '#3b82f6', // blue — 혼조/전환 (Elder 관례)
```
globals.css @theme: 세 토큰 미러(`--color-chart-impulse-bullish/bearish/neutral`).

### 3.4 레지스트리 (신규 kind `candle-paint`)
- `IndicatorKind` += `'candle-paint'` (레지스트리 헤더 주석이 이미 예고한 kind).
- `IndicatorKey` += `'elderImpulse'`.
- `INDICATOR_REGISTRY` += `{ key: 'elderImpulse', label: 'Elder Impulse', category: 'momentum', kind: 'candle-paint' }`. 32→33.
- `candle-paint`은 pane이 아니므로 `useIndicatorVisibility`의 `kind === 'pane'` 필터에 안 걸려 pane index를 받지 않는다(기존 로직 그대로). 가시성은 `visible.elderImpulse` + `toggle('elderImpulse')`(useIndicatorVisibility가 모든 레지스트리 키를 초기화).
- 모달은 kind 무관이라 무수정(자동 노출).
- makePaneIndices(paneLabelUtils.test) fallout: `elderImpulse: INACTIVE_PANE_INDEX` +1.

### 3.5 StockChart 배선
- candle setData effect를 `seriesRef.current.setData(buildCandlestickData(bars, indicators.elderImpulse, visible.elderImpulse))`로 변경. effect deps에 `indicators`(또는 `indicators.elderImpulse`)·`visible.elderImpulse` 추가(현재는 `[bars]` 류).
- `indicatorBindings` += `{ meta: INDICATOR_META.elderImpulse, active: visible.elderImpulse, onToggle: () => toggle('elderImpulse') }` (32→33). deps의 `visible`/`toggle`는 이미 포함.
- 범례·pane 라벨 없음(캔들 자체가 표현).

## 4. 데이터 흐름
```
indicatorRegistry (elderImpulse = kind:'candle-paint')
        │
useIndicatorVisibility → visible.elderImpulse (pane index 없음)
        │
binding(33개) → IndicatorSettingsModal 자동 노출(무수정)
        │
체크 → toggle('elderImpulse') → visible.elderImpulse=true
        │
candle setData effect 재실행 → buildCandlestickData(bars, indicators.elderImpulse, true)
        │
메인 캔들이 green/red/blue per-bar 색으로 재렌더 (off 시 기본 bull/bear 복원)
```

## 5. 테스트 전략 (vitest + RTL, 90%+, happy + worst)

### 5.1 단위 — 순수 함수
- **`impulseColor`**: green→impulseBullish, red→impulseBearish, blue→impulseNeutral.
- **`buildCandlestickData`**:
  - isImpulseActive=false → 모든 bar plain OHLC(색 필드 없음).
  - active + 색 있음 → color/borderColor/wickColor 모두 impulse 색.
  - active + 색 null(warm-up) → 해당 bar plain OHLC.
  - active + 일부 null 혼재 → 섞여 반환.
  - 빈 bars → [].
  - elderImpulse 배열이 bars보다 짧음(worst): 인덱스 초과 bar는 plain(undefined→plain).

### 5.2 StockChart 통합
- elderImpulse 토글 시 `seriesRef.setData`가 색 포함 데이터로 호출되는지(setData mock 인자 캡처 또는 buildCandlestickData spy). 토글 off 시 plain OHLC로 호출.
- (StockChart.test는 시리즈/차트 mock 구조이므로 기존 candle setData 검증 패턴에 맞춰 확장.)

### 5.3 레지스트리
- 레지스트리 33, elderImpulse가 momentum·candle-paint, 중복 없음.
- `candle-paint` kind가 pane index 미할당(useIndicatorVisibility.test에서 paneIndices에 elderImpulse 없음/INACTIVE 확인).

### 5.4 E2E
- `chart-indicators.spec.ts` 확장: 모달에서 'Elder Impulse' 체크 → candle-paint은 pane/overlay 라벨이 없으므로 **모달 체크박스 상태로 검증**(initial unchecked → check → checked, group-A overlay 패턴, exact 매처).

## 6. FSD 준수
- 헬퍼·색·순수함수: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(ImpulseColor/Bar). 레이어 정상. core 무변경.

## 7. 후속 (별도 스펙)
- 그룹 D-2: smc zone(premium/discount/equilibrium 가격 밴드, 신규 `zone` kind + 렌더 방식 결정 priceLine vs primitive). 별도 brainstorming→spec→plan→PR.
- 이후: 전송 페이로드 슬림화.
