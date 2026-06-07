# 미사용 보조지표 렌더링 — 6차: 그룹 A 나머지 (chandelierExit · parabolicSar)

- **작성일**: 2026-06-07
- **상태**: 설계 승인됨, 구현 계획 대기
- **브랜치**: `feat/render-group-a-rest` (base: `feat/render-supertrend` = PR #582)

## 1. 배경

미사용 보조지표 렌더링 6차이자 그룹 A(가격 오버레이) 마무리. supertrend(#582)에 이어 **chandelierExit·parabolicSar** 2종을 가격 오버레이(Pane 0)로 렌더한다. 한 spec/PR로 묶되 지표별 task로 분해한다(사용자 선택). 계산은 `@y0ngha/siglens-core`에 있으므로 추가 작업은 siglens 차트 렌더링뿐.

## 2. 자료조사 / 렌더 표준

웹 자료조사(StockCharts ChartSchool, TradingView) 결과:
- **Chandelier Exit**: 추세 따라 한쪽에만 나타나는 **단일 trailing stop 라인**. 상승 추세(long)엔 가격 **아래**(longStop = 기간고 − ATR×승수), 하락 추세(short)엔 가격 **위**(shortStop = 기간저 + ATR×승수). 가격이 active stop을 깨면 반대편으로 **flip**한다. → supertrend와 동일한 "추세별 색 + flip" 구조이나 **값 소스가 추세별로 다름**(long→longStop, short→shortStop).
- **Parabolic SAR**: 가격 위/아래 **점(dot) 시리즈**. 상승 추세엔 가격 아래(초록 점), 하락 추세엔 가격 위(빨강 점). SAR 정확값 위치에 점을 찍고 추세 반전 시 점이 반대편으로 이동.

데이터(siglens-core `domain/types.d.ts`):
```ts
interface ParabolicSARResult { sar: number | null; trend: TrendDirection; }      // 'up' | 'down' | null
interface ChandelierResult  { longStop: number | null; shortStop: number | null; trend: ChandelierTrend | null; } // 'long' | 'short'
// IndicatorResult.parabolicSar: ParabolicSARResult[]
// IndicatorResult.chandelierExit: ChandelierResult[]
```

LWC 5.2.0 API 확인:
- `LineSeries` 옵션에 `pointMarkersVisible: boolean` + `pointMarkersRadius?: number` 존재 → `lineVisible:false`와 조합하면 각 데이터 포인트 **정확값 위치에 점**만 렌더. parabolicSar 점에 적합.
- `lineStyle: LineStyle.Dashed` → chandelier 점선.

## 3. 핵심 설계 결정

### 3.1 `buildTrendSplitData` 일반화 (값 선택자 + 제네릭 추세)
세 지표(supertrend·sar·chandelier)가 "추세 일치 막대만 값, 나머지 whitespace"의 2-시리즈 분리를 공유한다. 현재 헬퍼는 `r.supertrend` 필드와 `SupertrendResult`에 하드코딩돼 있다. **값 선택자(getValue)와 추세 리터럴(Dir)을 제네릭화**해 셋 모두 재사용한다:

```ts
export function buildTrendSplitData<Dir extends string, T extends { trend: Dir | null }>(
    bars: Bar[],
    data: T[],
    dir: Dir,
    getValue: (r: T) => number | null
): SeriesPoint[] {
    const count = Math.min(bars.length, data.length);
    return bars.slice(0, count).map((bar, i) => {
        const r = data[i];
        if (r && r.trend === dir) {
            const value = getValue(r);
            // Bar.time은 epoch seconds 정수 — LWC UTCTimestamp(branded number)와 런타임 형태 동일하므로 safe-cast.
            if (value !== null) {
                return { time: bar.time as UTCTimestamp, value };
            }
        }
        return { time: bar.time as UTCTimestamp };
    });
}
```
- supertrend: `buildTrendSplitData(bars, st, 'up'|'down', r => r.supertrend)`
- parabolicSar: `buildTrendSplitData(bars, sar, 'up'|'down', r => r.sar)`
- chandelier long 시리즈: `buildTrendSplitData(bars, ch, 'long', r => r.longStop)`
- chandelier short 시리즈: `buildTrendSplitData(bars, ch, 'short', r => r.shortStop)`

| 항목 | 결정 | 근거 |
|---|---|---|
| 헬퍼 | 제네릭 일반화(값 선택자) | 3지표 공유, near-duplicate 방지 |
| supertrend 영향 | 호출부 1줄×2 + 헬퍼 테스트(getValue 인자) + useSupertrendOverlay 테스트 `toHaveBeenCalledWith`(`expect.any(Function)`) 갱신 | 일반화의 불가피한 churn, 전부 기계적 |

**기존 supertrend 호출부 변경(필수)**: `useSupertrendOverlay`의 두 `buildTrendSplitData(bars, supertrend, 'up'|'down')` → `(bars, supertrend, 'up'|'down', r => r.supertrend)`. 그리고 그 훅 테스트의 `toHaveBeenCalledWith(FAKE_BARS, ..., 'up')`는 4번째 인자(함수)가 추가되므로 `expect.any(Function)`을 덧붙인다.

### 3.2 `useParabolicSarOverlay` (점 마커)
- supertrend 훅 골격(자체 `useState(isVisible)`+toggle, prevChartRef, clearSeriesRefs/removeAllSeries useEffectEvent, 2-effect lifecycle/data-sync).
- 시리즈 2개: `upSeriesRef`(LineSeries, color=parabolicSarUp), `downSeriesRef`(color=parabolicSarDown). **둘 다 `lineVisible:false, pointMarkersVisible:true, pointMarkersRadius:2`** → 라인 없이 점만.
- 데이터: `upSeriesRef.setData(buildTrendSplitData(bars, parabolicSar, 'up', r => r.sar))`, down도 'down'. guard `if (!indicators.parabolicSar.length) return`.

### 3.3 `useChandelierOverlay` (점선 trailing stop)
- supertrend 훅 골격 복제.
- 시리즈 2개: `longSeriesRef`(LineSeries, color=chandelierLong), `shortSeriesRef`(color=chandelierShort). **둘 다 `lineStyle:LineStyle.Dashed`** (supertrend solid과 구분).
- 데이터: `longSeriesRef.setData(buildTrendSplitData(bars, chandelierExit, 'long', r => r.longStop))`, `shortSeriesRef.setData(buildTrendSplitData(bars, chandelierExit, 'short', r => r.shortStop))`. guard `if (!indicators.chandelierExit.length) return`.

### 3.4 레지스트리 (`model/indicatorRegistry.ts`)
- `IndicatorKey` +2 (`parabolicSar`, `chandelierExit`).
- `INDICATOR_REGISTRY` +2: 둘 다 `{ category: 'trend', kind: 'overlay' }`. 라벨 `Parabolic SAR` / `Chandelier`.
- makePaneIndices(paneLabelUtils.test) fallout: 두 키 모두 `INACTIVE_PANE_INDEX`(overlay).
- StockChart.test의 binding 카운트 27→29, data-keys에 두 키 추가.

### 3.5 색상 (`shared/lib/chartColors.ts` + `globals.css` @theme)
DESIGN.md 추세 고정값(bullish teal `#26a69a` / bearish red `#ef5350`) 재사용 — 코드베이스 시맨틱 alias 관례(trendlineAscending/supportLine/dmiPlus/supertrendUp 등) 준수:
- `parabolicSarUp: '#26a69a'`, `parabolicSarDown: '#ef5350'`
- `chandelierLong: '#26a69a'`, `chandelierShort: '#ef5350'`
- globals.css @theme: `--color-chart-parabolic-sar-up/down`, `--color-chart-chandelier-long/short`

### 3.6 OverlayLegend (`utils/overlayLabelUtils.ts`)
- params +`parabolicSarVisible: boolean`, `chandelierVisible: boolean`.
- parabolicSar config: `{ name: 'PSAR', color: parabolicSarUp, getValue: (ind,i) => ind.parabolicSar[i]?.sar ?? null, getColor: (ind,i) => trend==='down'?down:trend==='up'?up:neutral }` (supertrend의 per-bar getColor 패턴).
- chandelier config: `{ name: 'Chandelier', color: chandelierLong, getValue: (ind,i) => { const r=ind.chandelierExit[i]; return r?.trend==='long'?r.longStop:r?.trend==='short'?r.shortStop:null; }, getColor: (ind,i) => trend==='long'?long:trend==='short'?short:neutral }`.

### 3.7 StockChart (`StockChart.tsx`)
- `useParabolicSarOverlay(commonHookParams)`, `useChandelierOverlay(commonHookParams)` 호출.
- `buildOverlayLabelConfigs`에 `parabolicSarVisible`/`chandelierVisible` 전달 + deps.
- `indicatorBindings` +2 (27→29): `INDICATOR_META.parabolicSar`/`.chandelierExit` + 각 active/onToggle + deps.

## 4. 데이터 흐름
```
indicatorRegistry (parabolicSar·chandelierExit = kind:'overlay', trend)
        │
StockChart: useParabolicSarOverlay / useChandelierOverlay (각자 visible state)
        │
binding(29개) → IndicatorSettingsModal 자동 노출(무수정)
        │
체크 → toggle → Pane 0에:
  - PSAR: up/down 2 LineSeries(lineVisible:false, pointMarkers) = 추세별 색 점
  - Chandelier: long/short 2 LineSeries(dashed) = 추세별 색 stop 라인
buildTrendSplitData(일반화, 값 선택자)로 분리 데이터 생성
```

## 5. 테스트 전략 (vitest + RTL, 90%+, happy + worst)

### 5.1 단위
- **일반화된 `buildTrendSplitData`**: getValue 선택자 동작, Dir 'up'/'down'·'long'/'short' 모두, 불일치/null trend/null value → whitespace, 길이 불일치, 빈 입력. (supertrend 기존 6케이스 + chandelier longStop/shortStop 선택, sar 선택)
- **`useParabolicSarOverlay`**: isVisible 토글, chart null 시 미생성, true→2 LineSeries(addSeries 2회), false→removeSeries 2회, setData 2회 + up/down 방향+선택자 인자 명시(`toHaveBeenCalledWith(..., 'up', expect.any(Function))`), 빈 배열→미호출, bars 변경 재싱크, 안정 toggle 참조.
- **`useChandelierOverlay`**: 동일 패턴, 'long'/'short' 방향 + longStop/shortStop 선택자.
- **레지스트리**: 29개, 두 키가 trend·overlay, 중복 없음.
- **overlayLabelUtils**: parabolicSarVisible/chandelierVisible 시 config, getValue/getColor 정확(추세별 색·현재값).

### 5.2 E2E
- `chart-indicators.spec.ts` 확장: 모달에서 'Parabolic SAR'·'Chandelier' 각각 체크 → 초기 unchecked 검증 후 체크 상태 검증(overlay, #582 supertrend 패턴, exact 매처).

### 5.3 회귀
- supertrend 호출부/테스트 갱신(§3.1) 외 기존 overlay/pane 훅·useIndicatorVisibility·모달 무변경. StockChart binding 27→29, overlayLabelConfigs params 확장으로 기존 테스트 갱신.

## 6. FSD 준수
- 훅·레지스트리·색·legend·헬퍼: `widgets/chart` 내부 + `shared/lib/chartColors`. core import(ParabolicSARResult/ChandelierResult/IndicatorResult/TrendDirection/ChandelierTrend). 레이어 정상. core 무변경.

## 7. 후속 (별도 스펙)
- 그룹 A 완료. 다음: C-복합 3종(elderRay histogram, squeezeMomentum histo+state, regression 2-value), 그룹 D(elderImpulse candle coloring, smc zone primitive), 전송 페이로드 슬림화.
