# Domain

## 개요

`domain/`은 외부 의존성이 없는 순수 TypeScript 함수만 포함한다.
외부 라이브러리(technicalindicators 포함) import 금지.
모든 계산 로직은 직접 구현한다.

---

## 공통 타입

```typescript
// domain/types.ts

export type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

export interface TickerBase {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

export interface KoreanTickerEntry extends TickerBase {
    koreanName: string;
}

export interface TickerSearchResult extends TickerBase {
    koreanName?: string;
}

export interface Bar {
    time: number;   // Unix timestamp (초)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;  // Alpaca 제공
}

export interface VolumeProfileRow {
    price: number;    // bucket 중심가
    volume: number;   // 해당 구간 누적 거래량
}

export interface VolumeProfileResult {
    poc: number;                 // Point of Control 가격
    vah: number;                 // Value Area High
    val: number;                 // Value Area Low
    profile: VolumeProfileRow[]; // 가격대별 거래량 분포 (price 오름차순)
}

export interface IndicatorResult {
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    stochastic: StochasticResult[];
    stochRsi: StochRSIResult[];
    rsi: (number | null)[];
    cci: (number | null)[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
    volumeProfile: VolumeProfileResult | null;
    ichimoku: IchimokuResult[];
    atr: (number | null)[];
    obv: (number | null)[];
    parabolicSar: ParabolicSARResult[];
    williamsR: (number | null)[];
    supertrend: SupertrendResult[];
    mfi: (number | null)[];
    keltnerChannel: KeltnerChannelResult[];
    cmf: (number | null)[];
    donchianChannel: DonchianChannelResult[];
    buySellVolume: BuySellVolumeResult[];
    smc: SMCResult;
    squeezeMomentum: SqueezeMomentumResult[];
}

export interface MACDResult {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
}

export interface BollingerResult {
    upper: number | null;
    middle: number | null;
    lower: number | null;
}

export interface DMIResult {
    diPlus: number | null;
    diMinus: number | null;
    adx: number | null;
}

export interface StochasticResult {
    percentK: number | null;
    percentD: number | null;
}

export interface StochRSIResult {
    k: number | null;
    d: number | null;
}
```

---

## 마켓 상수

```typescript
// domain/constants/market.ts

export const DEFAULT_TIMEFRAME: Timeframe = '1Day';

// 유효한 타임프레임 전체 목록 — URL 파라미터 검증 등 모든 검증은 이 상수를 기준으로 한다.
export const TIMEFRAMES: readonly Timeframe[] = ['1Min', '5Min', '15Min', '1Hour', '1Day'];

// URL 쿼리 파라미터 등 외부 입력에서 Timeframe을 검증할 때 사용한다.
export function isValidTimeframe(value: string | undefined | null): value is Timeframe;
```

`isValidTimeframe`은 `TIMEFRAMES` 배열을 유일한 진실 공급원으로 삼는다.
호출 측에서 유효 타임프레임을 하드코딩하지 않는다.

---

## 인디케이터 상수

```typescript
// domain/indicators/constants.ts

export const RSI_DEFAULT_PERIOD = 14;
export const RSI_OVERBOUGHT_LEVEL = 70;
export const RSI_OVERSOLD_LEVEL = 30;

export const MACD_FAST_PERIOD = 12;
export const MACD_SLOW_PERIOD = 26;
export const MACD_SIGNAL_PERIOD = 9;

export const BOLLINGER_DEFAULT_PERIOD = 20;
export const BOLLINGER_DEFAULT_STD_DEV = 2;

export const DMI_DEFAULT_PERIOD = 14;

export const STOCHASTIC_K_PERIOD = 14;
export const STOCHASTIC_D_PERIOD = 3;
export const STOCHASTIC_SMOOTHING = 3;
export const STOCHASTIC_OVERBOUGHT_LEVEL = 80;
export const STOCHASTIC_OVERSOLD_LEVEL = 20;

export const STOCH_RSI_RSI_PERIOD = 14;
export const STOCH_RSI_STOCH_PERIOD = 14;
export const STOCH_RSI_K_PERIOD = 3;
export const STOCH_RSI_D_PERIOD = 3;
export const STOCH_RSI_OVERBOUGHT_LEVEL = 0.8;
export const STOCH_RSI_OVERSOLD_LEVEL = 0.2;

export const CCI_DEFAULT_PERIOD = 20;
export const CCI_NORMALIZATION_CONSTANT = 0.015;
export const CCI_OVERBOUGHT_LEVEL = 100;
export const CCI_OVERSOLD_LEVEL = -100;
export const CCI_ZERO_LEVEL = 0;

export const MA_DEFAULT_PERIODS = [5, 20, 60, 120, 200] as const;
export const EMA_DEFAULT_PERIODS = [9, 20, 21, 60] as const;

export const EMA_SUPPORT_RESISTANCE_SHORT_INDEX = 1; // 20기간 EMA
export const EMA_SUPPORT_RESISTANCE_LONG_INDEX = 3;  // 60기간 EMA

export const VP_DEFAULT_ROW_SIZE = 24;
export const VP_VALUE_AREA_PERCENTAGE = 0.7;
export const VP_MIN_BARS = 30;

export const SQUEEZE_MOMENTUM_BB_LENGTH = 20;
export const SQUEEZE_MOMENTUM_KC_LENGTH = 20;
export const SQUEEZE_MOMENTUM_KC_MULT = 1.5;

export const SMC_SWING_PERIOD = 5;
export const SMC_EQUAL_LEVEL_ATR_MULTIPLIER = 0.5;
export const SMC_ATR_PERIOD = 14;
export const SMC_PREMIUM_RATIO = 0.75;
export const SMC_DISCOUNT_RATIO = 0.25;
```

---

## 인디케이터 계산 명세

### RSI (Relative Strength Index)

```
기본 기간: 14
계산 방식: Wilder's Smoothing Method (EMA 방식)

알고리즘:
1. 전일 대비 변화량 계산 (diff = close[i] - close[i-1])
2. 상승분(gain)과 하락분(loss) 분리
3. 초기 avgGain, avgLoss = 첫 period개의 단순 평균
4. 이후: avgGain = (avgGain * (period - 1) + gain) / period (Wilder)
5. RS = avgGain / avgLoss
6. RSI = 100 - (100 / (1 + RS))

경계값:
- avgLoss === 0 이면 RSI = 100
- 초기 period개 미만 구간 = null
```

### MACD (Moving Average Convergence Divergence)

```
기본 설정: fastPeriod=12, slowPeriod=26, signalPeriod=9
계산 방식: EMA

알고리즘:
1. fastEMA = EMA(close, 12)
2. slowEMA = EMA(close, 26)
3. macdLine = fastEMA - slowEMA
4. signalLine = EMA(macdLine, 9)
5. histogram = macdLine - signalLine

초기 slowPeriod + signalPeriod - 2개 구간 = null
```

### Bollinger Bands

```
기본 설정: period=20, stdDev=2

알고리즘:
1. middle = SMA(close, 20)
2. std = 표준편차(close, 20)
3. upper = middle + (stdDev * std)
4. lower = middle - (stdDev * std)

초기 period - 1개 구간 = null
```

### DMI (Directional Movement Index)

```
기본 설정: period=14

알고리즘:
1. TR = max(high - low, |high - prevClose|, |low - prevClose|)
2. +DM = high - prevHigh (if > 0 and > prevLow - low, else 0)
3. -DM = prevLow - low (if > 0 and > high - prevHigh, else 0)
4. Wilder Smoothing 적용 (period=14)
5. +DI = 100 * (+DM14 / ATR14)
6. -DI = 100 * (-DM14 / ATR14)
7. DX = 100 * |+DI - -DI| / (+DI + -DI)
8. ADX = Wilder Smoothing(DX, period=14)

초기 period * 2 - 1개 구간 = null
```

### Stochastic Oscillator

```
기본 설정: kPeriod=14, dPeriod=3, smoothing=3

알고리즘 (Slow Stochastic):
1. Fast %K = (close - lowest_low_N) / (highest_high_N - lowest_low_N) * 100
   (N = kPeriod = 14)
2. Slow %K = SMA(Fast %K, smoothing=3)
3. %D = SMA(Slow %K, dPeriod=3)

범위: 0 ~ 100
과매수: 80 이상, 과매도: 20 이하
초기 kPeriod + smoothing - 2개 구간의 %K = null
초기 kPeriod + smoothing + dPeriod - 3개 구간의 %D = null
```

### Stochastic RSI

```
기본 설정: rsiPeriod=14, stochPeriod=14, kSmoothing=3, dPeriod=3

알고리즘:
1. RSI = calculateRSI(closes, rsiPeriod=14)
2. Stochastic RSI = (현재 RSI - stochPeriod 기간 RSI 최저값) / (RSI 최고값 - RSI 최저값)
3. %K = SMA(Stochastic RSI, kSmoothing=3)
4. %D = SMA(%K, dPeriod=3)

범위: 0.0 ~ 1.0 (100을 곱하지 않음)
과매수: 0.8 이상, 과매도: 0.2 이하
RSI range가 0이면 Stochastic RSI = 0
초기 rsiPeriod + stochPeriod - 1 + kSmoothing - 1개 구간의 K = null
초기 위 + dPeriod - 1개 구간의 D = null

StochRSIResult: { k: number | null; d: number | null }
```

### CCI (Commodity Channel Index)

```
기본 설정: period=20
표준화 상수: 0.015

알고리즘:
1. TP (Typical Price) = (고가 + 저가 + 종가) / 3
2. SMA(TP, period) = period개 TP의 단순이동평균
3. Mean Deviation = 평균(|TP - SMA(TP)|)
4. CCI = (TP - SMA(TP, period)) / (0.015 × Mean Deviation)

경계값:
- Mean Deviation === 0 이면 CCI = 0
- 초기 period - 1개 구간 = null
- 비한정형 오실레이터 (범위 제한 없음, 일반적으로 ±300 이내)

시그널:
- +100 이상: 과매수 / 강한 상승 추세
- -100 이하: 과매도 / 강한 하락 추세
- 0선 돌파: 추세 전환 초기 신호

반환 타입: (number | null)[]
```

### Ichimoku Cloud (일목균형표)

```
기본 설정: conversionPeriod=9, basePeriod=26, spanBPeriod=52, displacement=26

구성 요소:
- 전환선 (Tenkan-sen): N기간(9) 최고가+최저가 / 2
- 기준선 (Kijun-sen): N기간(26) 최고가+최저가 / 2
- 선행스팬A (Senkou Span A): (전환선 + 기준선) / 2, 26봉 선행 표시
- 선행스팬B (Senkou Span B): 52기간 최고가+최저가 / 2, 26봉 선행 표시
- 후행스팬 (Chikou Span): 현재 종가, 26봉 후행 표시

알고리즘:
- periodMidpoint(bars, endIndex, period) = 해당 기간 (최고가+최저가) / 2
- tenkan[i] = periodMidpoint(bars, i, 9)
- kijun[i] = periodMidpoint(bars, i, 26)
- senkouA[i] = (tenkan[i-26] + kijun[i-26]) / 2  (소스 인덱스 i-26)
- senkouB[i] = periodMidpoint(bars, i-26, 52)  (소스 인덱스 i-26)
- chikou[i] = bars[i+26].close

null 조건:
- tenkan: i < 8 (conversionPeriod - 1)
- kijun: i < 25 (basePeriod - 1)
- senkouA: i < 51 (displacement + basePeriod - 1)
- senkouB: i < 77 (displacement + spanBPeriod - 1)
- chikou: i > bars.length - displacement - 1

배열 크기: bars.length (기존 지표와 동일)

반환 타입: IchimokuResult[]

IchimokuResult: {
  tenkan: number | null;
  kijun: number | null;
  senkouA: number | null;
  senkouB: number | null;
  chikou: number | null;
}

calculateIchimokuFutureCloud 함수:
  목적: 현재 시점 이후 displacement개 미래 포인트의 선행스팬A/B 값을 계산
        (차트에서 구름대를 displacement봉 앞에 투영하기 위해 사용)
  시그니처: calculateIchimokuFutureCloud(
    bars: Bar[],
    conversionPeriod = 9,
    basePeriod = 26,
    spanBPeriod = 52,
    displacement = 26
  ): IchimokuFuturePoint[]

  반환 타입: IchimokuFuturePoint[]
  IchimokuFuturePoint: {
    senkouA: number | null;
    senkouB: number | null;
  }

  배열 크기: bars가 빈 배열인 경우 빈 배열을 반환. 그 외에는 항상 displacement (기본값 26) 길이의 배열
  계산 방식: bars의 마지막 displacement 구간(bars.length - displacement ~ bars.length - 1)에서
             각 sourceIndex에 대해 senkouA / senkouB 계산

렌더링 규칙:
- SenkouA/B는 반드시 displacement(26)봉 미래로 투영하여 표시
- 구름대(SenkouA~SenkouB 사이)는 bullish(SenkouA > SenkouB)와 bearish(SenkouA < SenkouB)를 구분하여 색상 표시
```

### Volume Profile

```
기본 설정: rowSize=24, valueAreaPercentage=0.7, minBars=30

반환 타입: VolumeProfileResult | null
- bars 수가 VP_MIN_BARS(30) 미만이면 null 반환

알고리즘:
1. bars 전체에서 high 최댓값, low 최솟값으로 가격 범위 산출
2. 가격 범위를 rowSize(기본 24)개 bucket으로 균등 분할
3. 각 bar에 대해: bar의 high~low 범위에 걸치는 bucket들에 volume을 비례 배분
4. POC = 거래량 최대 bucket의 중심가
5. Value Area = POC bucket부터 좌우로 확장하며 전체 거래량의 70% 도달 시 VAH/VAL 결정
6. profile은 price 오름차순 정렬로 반환

주의사항:
- 변수명 window 사용 금지 → priceRange 등으로 대체 (브라우저 글로벌 쉐도잉)
- priceRange === 0이면 null 반환
```

### VWAP (Volume Weighted Average Price)

```
계산 방식: 일 단위 누적 (장 시작부터 현재까지)

알고리즘:
1. typicalPrice = (high + low + close) / 3
2. cumulativeTPV += typicalPrice * volume
3. cumulativeVolume += volume
4. vwap = cumulativeTPV / cumulativeVolume

주의: 봉 데이터에 날짜 변경 시 누적값 초기화
```

### EMA (Exponential Moving Average)

```
기본 기간: [9, 20, 21, 60]  ← EMA_DEFAULT_PERIODS (전체 상수)

타임프레임별 실제 사용 기간:
- 1Min       → [9, 21]   (EMA_DEFAULT_PERIODS에서 9, 21만 선택)
- 5Min~1Day  → [20, 60]  (EMA_DEFAULT_PERIODS에서 20, 60만 선택)

EMA_DEFAULT_PERIODS는 모든 타임프레임에서 사용 가능한 기간의 합집합이다.
구현체는 EMA_DEFAULT_PERIODS 전체를 계산하지 않고,
타임프레임별 인디케이터 설정표에 따라 해당 기간만 필터링하여 계산한다.

알고리즘:
1. 첫 번째 값 = 초기 period개의 SMA
2. multiplier = 2 / (period + 1)
3. EMA = close * multiplier + prevEMA * (1 - multiplier)

초기 period - 1개 구간 = null
```

### MA (Simple Moving Average)

```
기본 기간: [5, 20, 60, 120, 200]

알고리즘:
1. MA = 최근 period개 close의 단순 평균

초기 period - 1개 구간 = null
```

### ATR (Average True Range)

```
기본 기간: 14

알고리즘:
1. TR(i) = max(High - Low, |High - PrevClose|, |Low - PrevClose|)
2. 초기 ATR = 첫 period개 TR의 SMA
3. 이후 Wilder 평활: ATR(i) = (ATR(i-1) × (period-1) + TR(i)) / period

초기 period개 구간 = null
```

### OBV (On-Balance Volume)

```
기간: 없음 (누적 지표)

알고리즘:
1. OBV(0) = Volume(0)
2. Close > PrevClose: OBV += Volume
3. Close < PrevClose: OBV -= Volume
4. Close = PrevClose: OBV 유지

null 없음 (첫 봉부터 값 존재)
```

### Parabolic SAR (Stop and Reverse)

```
기본 파라미터: afStart=0.02, afIncrement=0.02, afMax=0.20

알고리즘 (상태 기반):
1. 초기: bars[1].close >= bars[0].close이면 상승 추세, 그렇지 않으면 하락 추세로 시작. 상승 추세: SAR = bars[0].low, EP = bars[1].high. 하락 추세: SAR = bars[0].high, EP = bars[1].low
2. SAR(i+1) = SAR(i) + AF × (EP - SAR(i))
3. 반전 조건: 상승 추세에서 Low < SAR → 하락 전환, 하락 추세에서 High > SAR → 상승 전환
4. 새 EP 갱신 시 AF += afIncrement (최대 afMax)

반환 타입: ParabolicSARResult { sar, trend: 'up' | 'down' | null }
첫 번째 봉 = null
```

### Williams %R

```
기본 기간: 14

알고리즘:
1. %R = (HH - Close) / (HH - LL) × (-100)
2. HH = period 구간 최고 High, LL = period 구간 최저 Low
3. HH = LL이면 -50 반환

범위: 0 ~ -100
초기 period - 1개 구간 = null
```

### Supertrend

```
기본 파라미터: atrPeriod=10, multiplier=3.0

알고리즘:
1. HL2 = (High + Low) / 2
2. BasicUpperBand = HL2 + multiplier × ATR
3. BasicLowerBand = HL2 - multiplier × ATR
4. FinalUpperBand/FinalLowerBand: 이전 밴드와 비교하여 조정
5. trend = 'up'이면 supertrend = FinalLowerBand, 'down'이면 FinalUpperBand

의존성: calculateATR
반환 타입: SupertrendResult { supertrend, trend: 'up' | 'down' | null }
초기 atrPeriod개 구간 = null
```

### MFI (Money Flow Index)

```
기본 기간: 14

알고리즘:
1. TP = (High + Low + Close) / 3
2. RawMF = TP × Volume
3. TP > 이전 TP: Positive MF, TP < 이전 TP: Negative MF
4. MFR = Σ PositiveMF(period) / Σ NegativeMF(period)
5. MFI = 100 - 100 / (1 + MFR)

범위: 0 ~ 100
초기 period개 구간 = null
```

### Keltner Channel

```
기본 파라미터: emaPeriod=20, atrPeriod=10, multiplier=2.0

알고리즘:
1. Middle = EMA(Close, emaPeriod)
2. Upper = Middle + multiplier × ATR(atrPeriod)
3. Lower = Middle - multiplier × ATR(atrPeriod)

의존성: computeEMAValues, calculateATR
반환 타입: KeltnerChannelResult { upper, middle, lower }
초기 max(emaPeriod, atrPeriod) - 1개 구간 = null
```

### CMF (Chaikin Money Flow)

```
기본 기간: 21

알고리즘:
1. CLV = ((Close - Low) - (High - Close)) / (High - Low)
2. High = Low이면 CLV = 0
3. CMF = Σ(CLV × Volume, period) / Σ(Volume, period)

범위: -1 ~ +1
초기 period - 1개 구간 = null
```

### Donchian Channel

```
기본 기간: 20

알고리즘:
1. Upper = max(High, period)
2. Lower = min(Low, period)
3. Middle = (Upper + Lower) / 2

반환 타입: DonchianChannelResult { upper, middle, lower }
초기 period - 1개 구간 = null
```

### Buy/Sell Volume

```
출처: TradingView PineScript "BS" 인디케이터 기반

알고리즘:
1. range = high - low
2. if range === 0: { buyVolume: 0, sellVolume: 0 }
3. else: { buyVolume: volume × (close - low) / range, sellVolume: volume × (high - close) / range }

반환 타입: BuySellVolumeResult { buyVolume, sellVolume }
초기 null 없음 (모든 봉에 값 반환)
```

### SMC (Smart Money Concepts)

```
참고: ICT (Inner Circle Trader) / Smart Money Concepts 방법론
원본 TradingView 인디케이터: "Smart Money Concepts [LuxAlgo]" by LuxAlgo
독립적인 TypeScript 재구현 — PineScript 소스 코드의 직접 포팅 아님

파라미터: swingPeriod=5, atrPeriod=14, equalLevelAtrMult=0.5,
          premiumRatio=0.75, discountRatio=0.25

반환 타입: SMCResult (단일 객체, 배열 아님)

구성 요소 및 알고리즘:

1. Swing Points (스윙 고점/저점)
   - 인덱스 i가 스윙 고점: bars[i-period..i+period] 범위에서 high 최댓값
   - 인덱스 i가 스윙 저점: bars[i-period..i+period] 범위에서 low 최솟값
   - 양 끝에서 period개 봉은 미확정 → 제외
   - 결과: swingHighs[], swingLows[] (각각 { index, price, type })

2. Fair Value Gap (공정가치 갭, FVG)
   - 상승 FVG (bar i): bars[i].low > bars[i-2].high
     → 갭 구간: [bars[i-2].high, bars[i].low]
   - 하락 FVG (bar i): bars[i].high < bars[i-2].low
     → 갭 구간: [bars[i].high, bars[i-2].low]
   - 완화(mitigation): 이후 봉이 갭 구간을 재진입하면 isMitigated=true
   - 결과: fairValueGaps[] (각각 { index, high, low, type, isMitigated })

3. Structure Breaks (구조 이탈: BOS / CHoCH)
   상태머신 방식으로 스윙 레벨 돌파를 추적:
   - BOS (Break of Structure): 현재 추세 방향의 스윙 레벨 돌파 (추세 지속)
   - CHoCH (Change of Character): 현재 추세 반대 방향 스윙 레벨 돌파 (추세 전환 가능)
   - 판단 기준: close 가격이 활성 스윙 레벨을 돌파하면 기록
   - 결과: structureBreaks[] (각각 { index, price, type, breakType })

4. Order Blocks (주문 블록)
   - 각 구조 이탈(structureBreak)에 대해:
     - 상승 이탈: 이탈 직전 마지막 하락 봉 (close < open)
     - 하락 이탈: 이탈 직전 마지막 상승 봉 (close > open)
   - 완화(mitigation):
     - 상승 OB: 이후 봉의 low가 OB.low 하회
     - 하락 OB: 이후 봉의 high가 OB.high 상회
   - 결과: orderBlocks[] (각각 { startIndex, high, low, type, isMitigated })

5. Equal Highs / Equal Lows (EQH / EQL)
   - 두 스윙 고점의 가격 차이 ≤ ATR × equalLevelAtrMult(0.5) → Equal High
   - 두 스윙 저점의 가격 차이 ≤ ATR × equalLevelAtrMult(0.5) → Equal Low
   - 가격: 두 피벗의 중간값
   - 결과: equalHighs[], equalLows[] (각각 { price, firstIndex, secondIndex, type })

6. Premium / Equilibrium / Discount Zones
   - 가장 최근 스윙 고점과 저점으로 범위 산출
   - Premium zone:     [rangeTop, rangeBottom + 0.75 × range]  (상단 25%)
   - Equilibrium zone: [rangeBottom + 0.75 × range, rangeBottom + 0.25 × range]  (중간 50%)
   - Discount zone:    [rangeBottom + 0.25 × range, rangeBottom]  (하단 25%)
   - 결과: premiumZone, equilibriumZone, discountZone (각각 { high, low, type } | null)

의존성: calculateATR (swingPeriod × 2 + 1 미만 봉은 빈 결과 반환)
```

### Squeeze Momentum Indicator

```
원작자: LazyBear (PineScript "Squeeze Momentum Indicator [LazyBear]")
출처: https://kr.tradingview.com/script/nqQ1DT5a-Squeeze-Momentum-Indicator-LazyBear/
독립적인 TypeScript 재구현 — PineScript 소스 코드의 직접 포팅 아님

파라미터: bbLength=20, kcLength=20, kcMult=1.5
          (주의: BB 표준편차에도 kcMult=1.5 적용 — 원본 스크립트 동일)

반환 타입: SqueezeMomentumResult[]

알고리즘:

1. Bollinger Bands
   basis = SMA(close, bbLength=20)
   dev   = kcMult(1.5) × stdDev(close, bbLength)
   upperBB = basis + dev
   lowerBB = basis - dev

2. Keltner Channel
   ma      = SMA(close, kcLength=20)
   rangema = SMA(trueRange, kcLength)
   upperKC = ma + rangema × kcMult(1.5)
   lowerKC = ma - rangema × kcMult(1.5)

3. Squeeze 상태 (세 상태는 상호 배타적)
   sqzOn  = lowerBB > lowerKC AND upperBB < upperKC  (BB가 KC 안에 압축)
   sqzOff = lowerBB < lowerKC AND upperBB > upperKC  (BB가 KC 밖으로 팽창)
   noSqz  = NOT sqzOn AND NOT sqzOff                 (전환 중간 상태)

4. 모멘텀 값 (momentum)
   delta[i] = close[i] - avg(avg(highest(high, kcLength), lowest(low, kcLength)), SMA(close, kcLength))
   momentum = linreg(delta_window[i-kcLength+1 .. i], kcLength)

   momentum > 0: 상승 모멘텀, momentum < 0: 하락 모멘텀
   momentum 부호 전환: 모멘텀 방향 반전 신호

5. increasing
   momentum > prevMomentum: true (모멘텀 강화)
   momentum < prevMomentum: false (모멘텀 약화)
   첫 번째 유효 momentum: null

초기 max(bbLength, kcLength) - 1개 구간 = null
```

### calculateIndicators 통합 함수

```typescript
// domain/indicators/index.ts

function calculateIndicators(bars: Bar[]): IndicatorResult {
    // MA_DEFAULT_PERIODS, EMA_DEFAULT_PERIODS 상수를 사용해
    // 각 기간별로 계산 후 Record<number, (number | null)[]> 형태로 반환
    // volumeProfile: calculateVolumeProfile(bars) — bars < VP_MIN_BARS면 null
    // smc: calculateSmc(bars) — 단일 SMCResult 객체 (배열 아님)
    // squeezeMomentum: calculateSqueezeMomentum(bars) — SqueezeMomentumResult[]
}
```

---

## 핵심 레벨 검증 명세

### 위치

`domain/analysis/keyLevels.ts` — 순수 함수로 구현, 외부 의존성 없음.

```typescript
validateKeyLevels(keyLevels: KeyLevels): KeyLevels
```

- `price <= 0` 이거나 `reason`이 빈 문자열인 지지/저항 항목을 제거
- `poc`가 유효하지 않으면 `undefined`로 변환
- 순수 함수 — 사이드 이펙트 없음

---

## 캔들 패턴 감지 명세

### 위치

`domain/analysis/candle.ts` — 순수 함수로 구현, 외부 의존성 없음.

### 단봉 패턴 (CandlePattern)

```typescript
type CandlePattern =
    // Doji 계열
    | 'flat'              // 시고저종 동일
    | 'gravestone_doji'   // 위꼬리만 긴 도지
    | 'dragonfly_doji'    // 아래꼬리만 긴 도지
    | 'doji'              // 일반 도지
    // Marubozu 계열
    | 'bullish_marubozu'  // 상승 마루보주 (몸통 90% 이상)
    | 'bearish_marubozu'  // 하락 마루보주
    // 반전 패턴
    | 'shooting_star'     // 유성형 (위꼬리 긴 하락 전환)
    | 'inverted_hammer'   // 역망치 (위꼬리 긴 상승 전환)
    | 'hammer'            // 망치형 (아래꼬리 긴 상승 전환)
    | 'hanging_man'       // 교수형 (아래꼬리 긴 하락 전환)
    | 'bullish_belt_hold' // 상승 벨트홀드
    | 'bearish_belt_hold' // 하락 벨트홀드
    // 기본 형태
    | 'spinning_top'      // 팽이형 (몸통 작고 꼬리 양쪽)
    | 'bullish'           // 일반 양봉
    | 'bearish';          // 일반 음봉
```

### 다봉 패턴 (MultiCandlePattern)

```typescript
type MultiCandlePattern =
    // 상승 반전 (15종)
    | 'bullish_engulfing'        // 상승 장악형
    | 'bullish_harami'           // 상승 잉태형
    | 'bullish_harami_cross'     // 상승 십자 잉태형
    | 'piercing_line'            // 관통형
    | 'bullish_counterattack_line' // 상승 반격선
    | 'morning_star'             // 샛별형
    | 'morning_doji_star'        // 도지 샛별형
    | 'bullish_abandoned_baby'   // 상승 버려진 아기
    | 'three_white_soldiers'     // 적삼병
    | 'three_inside_up'          // 상승 삼내형
    | 'three_outside_up'         // 상승 삼외형
    | 'bullish_triple_star'      // 상승 삼성형
    | 'ladder_bottom'            // 사다리바닥
    | 'tweezers_bottom'          // 족집게 바닥
    | 'downside_gap_two_rabbits' // 하락갭 투래빗
    // 하락 반전 (15종)
    | 'bearish_engulfing'        // 하락 장악형
    | 'bearish_harami'           // 하락 잉태형
    | 'bearish_harami_cross'     // 하락 십자 잉태형
    | 'dark_cloud_cover'         // 먹구름형
    | 'bearish_counterattack_line' // 하락 반격선
    | 'evening_star'             // 석별형
    | 'evening_doji_star'        // 도지 석별형
    | 'bearish_abandoned_baby'   // 하락 버려진 아기
    | 'three_black_crows'        // 흑삼병
    | 'three_inside_down'        // 하락 삼내형
    | 'three_outside_down'       // 하락 삼외형
    | 'bearish_triple_star'      // 하락 삼성형
    | 'advance_block'            // 전진 저지형
    | 'tweezers_top'             // 족집게 천장
    | 'upside_gap_two_crows'     // 상승갭 까마귀 2마리
    // 지속 패턴 (4종)
    | 'upside_gap_tasuki'        // 상승갭 타스키
    | 'downside_gap_tasuki'      // 하락갭 타스키
    | 'on_neck'                  // 온넥
    | 'in_neck';                 // 인넥
```

### 감지 함수

```typescript
// 단봉: 현재 봉 1개로 판별
detectCandlePattern(bar: Bar): CandlePattern

// 다봉: 최근 2~3봉으로 판별 (감지 안 되면 null)
detectMultiCandlePattern(bars: Bar[]): MultiCandlePattern | null
```

### 다봉 > 단봉 우선순위

동일 봉에서 다봉 패턴과 단봉 패턴이 동시에 감지될 경우, 다봉 패턴이 우선한다.
다봉 패턴에 관여한 봉들의 단봉 패턴은 억제한다.

```
예: 봉 A, B, C에서 morning_star(다봉) 감지
  → 봉 A, B, C의 단봉 패턴(doji, hammer 등)은 표시하지 않음
```

### 감지 기준 상수

```
DOJI_BODY_RATIO = 0.1       — 몸통이 전체의 10% 이하이면 도지
DOJI_TAIL_RATIO = 0.1       — 꼬리 최소 비율
LONG_SHADOW_RATIO = 2       — 긴 꼬리 판정 배율
SHORT_SHADOW_RATIO = 1      — 짧은 꼬리 판정 배율
MARUBOZU_BODY_RATIO = 0.9   — 몸통이 90% 이상이면 마루보주
SPINNING_TOP_BODY_RATIO = 0.4 — 몸통 40% 이하이면 팽이
LONG_DAY_BODY_RATIO = 0.6   — 몸통 60% 이상이면 장대봉
BELT_HOLD_TAIL_RATIO = 0.1  — 벨트홀드 꼬리 허용 비율
NEAR_PRICE_TOLERANCE = 0.002 — 가격 근접 판정 허용오차 (0.2%)
IN_NECK_RATIO = 0.05        — 인넥 허용 비율
```

---

## 대규모 패턴 감지 (Skills 기반)

헤드앤숄더, 이중천장 등 대규모 차트 패턴은 알고리즘이 아닌 **AI + Skills 파일** 기반으로 수행한다.
`type: pattern`인 skill 파일이 활성화되면 AI가 해당 패턴 기준에 따라 직접 감지한다.
별도의 도메인 감지 함수는 존재하지 않는다.

### 현재 등록된 패턴 Skills

| skill 파일 | 패턴 | 신뢰도 |
|---|---|---|
| `patterns/head-and-shoulders.md` | head_and_shoulders (하락 반전) | 0.8 |
| `patterns/inverse-head-and-shoulders.md` | inverse_head_and_shoulders (상승 반전) | 0.8 |
| `patterns/double-top.md` | double_top (하락 반전) | 0.75 |
| `patterns/double-bottom.md` | double_bottom (상승 반전) | 0.75 |
| `patterns/ascending-wedge.md` | ascending_wedge (하락 반전) | 0.7 |
| `patterns/descending-wedge.md` | descending_wedge (상승 반전) | 0.7 |

---

## 인디케이터 신호 가이드 (Skills 기반)

인디케이터의 신호 해석 기준은 **AI + Skills 파일** 기반으로 수행한다.
`type: indicator_guide`인 skill 파일이 활성화되면 AI가 해당 가이드에 따라 인디케이터 수치를 해석한다.

> **참고**: `indicators` 필드에 명시된 인디케이터가 `IndicatorResult`에서 계산되어 전달되는 경우, AI는 정확한 수치를 기반으로 해석한다.
> 계산되지 않는 인디케이터의 경우, AI는 raw bar 데이터(OHLCV)에서 근사 분석을 수행할 수 있다.

### 현재 등록된 인디케이터 신호 가이드 Skills

| skill 파일 | 인디케이터 | 용도 | 신뢰도 |
|---|---|---|---|
| `indicators/rsi.md` | RSI(14) | 과매수/과매도, 다이버전스 | 0.9 |
| `indicators/macd.md` | MACD(12,26,9) | 크로스오버, 히스토그램, 다이버전스 | 0.9 |
| `indicators/bollinger-bands.md` | Bollinger Bands(20,2) | 스퀴즈, 밴드워크, 평균회귀 | 0.85 |
| `indicators/adx.md` | ADX(14) | 추세 강도 측정, 시장 국면 | 0.85 |
| `indicators/dmi.md` | DMI(14) | +DI/-DI 크로스, 추세 방향 | 0.85 |
| `indicators/stochastic.md` | Stochastic(14,3,3) | 과매수/과매도, 크로스오버 | 0.85 |
| `indicators/stochastic-rsi.md` | StochRSI(14,14,3,3) | RSI 기반 모멘텀 극값 | 0.8 |
| `indicators/cci.md` | CCI(20) | 과매수/과매도, 추세 | 0.8 |
| `indicators/ema.md` | EMA | 추세 방향, 동적 지지/저항 | 0.85 |
| `indicators/ma.md` | MA | 추세 방향, 골든/데드 크로스 | 0.85 |
| `indicators/vwap.md` | VWAP | 기관 공정가치, 장중 편향 | 0.85 |
| `indicators/volume-profile.md` | Volume Profile | POC, VAH/VAL, 거래량 분포 | 0.85 |
| `indicators/ichimoku-cloud.md` | Ichimoku Cloud | 구름, 전환선/기준선 | 0.85 |
| `indicators/atr.md` | ATR(14) | 변동성 측정, 손절 설정 | 0.85 |
| `indicators/obv.md` | OBV | 거래량 누적, 다이버전스 | 0.8 |
| `indicators/parabolic-sar.md` | Parabolic SAR(0.02, 0.20) | 추세 방향, 트레일링 스톱 | 0.8 |
| `indicators/williams-r.md` | Williams %R(14) | 과매수/과매도, 모멘텀 | 0.8 |
| `indicators/supertrend.md` | Supertrend(10, 3.0) | ATR 기반 추세 추종 | 0.8 |
| `indicators/mfi.md` | MFI(14) | 거래량 가중 과매수/과매도 | 0.8 |
| `indicators/keltner-channel.md` | Keltner Channel(20, 10, 2.0) | ATR 채널, 스퀴즈 | 0.8 |
| `indicators/cmf.md` | CMF(21) | 자금 흐름 방향/강도 | 0.75 |
| `indicators/donchian-channel.md` | Donchian Channel(20) | 브레이크아웃, Turtle Trading | 0.8 |
| `indicators/buy-sell-volume.md` | Buy/Sell Volume | 캔들 내 매수/매도 압력 분해 | 0.75 |
| `indicators/squeeze-momentum.md` | Squeeze Momentum(BB:20,KC:20,mult:1.5) | BB/KC 스퀴즈 감지, 모멘텀 방향 | 0.8 |
| `indicators/smart-money-concepts.md` | 스마트 머니 컨셉 (SMC) | BOS/CHoCH 구조, 오더 블록, FVG, 프리미엄·디스카운트 존 해석 | 0.85 |

> **SMC**는 `smc` 필드(`IndicatorResult.smc`)를 참조한다.
> `indicators: ['atr', 'smc']`로 선언되어 있으며, AI는 Swing Points, Order Blocks, FVG,
> Structure Breaks, Premium/Discount Zone 데이터를 직접 해석한다.

---

## 전략 Skills (Strategy Skills)

투자 전략 분석은 **AI + Skills 파일** 기반으로 수행한다.
`type: strategy`인 skill 파일이 활성화되면 AI가 해당 전략 기준에 따라 차트를 해석한다.

### 현재 등록된 전략 Skills

| skill 파일 | 전략 | 신뢰도 |
|---|---|---|
| `strategies/ma-cycle.md` | 이동평균선 대순환 분석 | 0.8 |
| `strategies/macd-cycle.md` | MACD 대순환 분석 | 0.75 |
| `strategies/multi-timeframe.md` | 다중 시간대 분석 | 0.75 |
| `strategies/breakout.md` | 브레이크아웃 전략 | 0.7 |
| `strategies/divergence.md` | 다이버전스 전략 | 0.7 |
| `strategies/mean-reversion.md` | 평균 회귀 전략 | 0.7 |
| `strategies/elliott-wave.md` | 엘리어트 파동 | 0.7 |
| `strategies/fibonacci.md` | 피보나치 전략 | 0.65 |
| `strategies/wyckoff.md` | 와이코프 방법론 | 0.0 (비활성) |

---

## AI 프롬프트 구성 명세

### 입력 데이터

```typescript
// buildAnalysisPrompt 파라미터
function buildAnalysisPrompt(
    symbol: string,
    bars: Bar[],
    indicators: IndicatorResult,
    skills: Skill[] = []
): string
```

### 프롬프트 구조

```
1. 종목명
2. 현재 시장 상황 요약 (현재가, 변화율, 거래량)
3. 최근 봉 데이터 (최근 30봉) — 각 봉에 캔들 패턴 태깅 + 다봉 패턴 감지
4. 거래량 분석 (평균 대비 비율)
5. 인디케이터 수치 (RSI, MACD, 볼린저, DMI, Stochastic, StochRSI, CCI, Volume Profile POC/VAH/VAL, Ichimoku 전환선/기준선/SpanA/SpanB/후행스팬)
6. 인디케이터 신호 가이드 (type='indicator_guide' skills, confidence >= 0.5)
7. 패턴 분석 (type='pattern' skills, confidence >= 0.5)
8. 전략 분석 (type='strategy' skills, confidence >= 0.5)
9. 활성화된 Skills (type 없는 skills, confidence >= 0.5)
10. 분석 가이드라인 (지지/저항 판단 기준, 가격 목표 산출 기준)
11. 분석 요청 및 JSON 응답 형식 지시
```

### 응답 형식 (JSON)

```typescript
type Trend = 'bullish' | 'bearish' | 'neutral';
type RiskLevel = 'low' | 'medium' | 'high';
type SignalStrength = 'strong' | 'moderate' | 'weak';
type SignalType = 'skill';

interface Signal {
    type: SignalType;
    description: string;
    strength: SignalStrength;
}

interface IndicatorGuideResult {
    indicatorName: string;     // indicator_guide skill 표시 이름 (예: 'RSI Signal Guide')
    signals: Signal[];
}

interface KeyPrice {
    label: string;          // 가격대 레이블 (예: 'neckline', 'breakout point')
    price: number;          // 해당 가격
}

interface KeyLevel {
    price: number;
    reason: string;         // 해당 가격이 지지/저항인 근거
}

interface KeyLevels {
    support: KeyLevel[];
    resistance: KeyLevel[];
    poc?: KeyLevel;         // Point of Control (거래 집중 가격대, 선택적)
}

interface PriceTarget {
    price: number;
    basis: string;          // 목표가 산출 근거
}

interface PriceScenario {
    targets: PriceTarget[];
    condition: string;      // 해당 시나리오의 전제 조건 (예: '110 돌파 시')
}

interface PriceTargets {
    bullish: PriceScenario;
    bearish: PriceScenario;
}

// 감지된 패턴별 개별 요약 (type='pattern' skill 결과)
interface PatternSummary {
    id: string;                          // 고유 ID (patternName_index 형식, React key 및 가시성 제어용)
    patternName: string;                 // skill의 pattern 식별자 (예: 'double_top')
    skillName: string;                   // skill 표시 이름 (예: '이중고점')
    detected: boolean;                   // 현재 차트에서 감지 여부
    trend: Trend;                        // 해당 패턴이 시사하는 방향
    summary: string;                     // AI가 작성한 패턴별 요약
    keyPrices?: KeyPrice[];              // 패턴의 주요 가격대 목록 (선택적)
    timeRange?: { start: number; end: number }; // 패턴이 감지된 시간 범위 (Unix timestamp, 선택적)
    confidenceWeight: number;            // skill의 confidence_weight 값 (0~1)
}

// 캔들 패턴별 감지 결과
interface CandlePatternSummary {
    id: string;            // 고유 ID (patternName_index 형식, React key용)
    patternName: string;   // 캔들 패턴 식별자
    detected: boolean;     // 현재 차트에서 감지 여부
    trend: Trend;          // 해당 패턴이 시사하는 방향
    summary: string;       // AI가 작성한 패턴별 요약
}

// 전략 skill별 분석 결과 (type='strategy' skill)
interface StrategyResult {
    id: string;                 // 고유 ID (strategyName_index 형식, React key용)
    strategyName: string;       // 전략 skill 표시 이름 (예: '엘리어트 파동')
    trend: Trend;               // 해당 전략 분석이 시사하는 방향
    summary: string;            // AI가 작성한 전략 요약 (markdown **label**: value 형식)
    confidenceWeight: number;   // skill의 신뢰도 가중치 (0~1)
}

interface ActionRecommendation {
    positionAnalysis: string;  // 현재 가격의 지지/저항 대비 위치
    entry: string;             // 구체적 가격대를 포함한 진입 전략
    exit: string;              // 익절/손절 가격대를 포함한 청산 전략
    riskReward: string;        // 손익비 계산 (예: "1:3")
}

interface AnalysisResponse {
    summary: string;
    trend: Trend;
    indicatorResults: IndicatorGuideResult[]; // indicator_guide skill 기반 신호 (indicatorName별 그룹핑) — "보조지표" 섹션에 렌더링
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
    priceTargets: PriceTargets;     // 강세/약세 시나리오별 가격 목표
    patternSummaries: PatternSummary[];         // 차트 패턴 결과 (type='pattern' skill) — "차트 패턴" 섹션에 렌더링
    strategyResults: StrategyResult[];          // 전략 skill 분석 결과 (type='strategy' skill) — "전략" 섹션에 렌더링
    candlePatterns: CandlePatternSummary[];     // 캔들 패턴 감지 결과
    trendlines: Trendline[];                    // AI가 감지한 추세선 목록 (0~3개)
    actionRecommendation?: ActionRecommendation; // 매매 전략 추천 (optional)
}
```

### 필드 ↔ UI 렌더링 매핑

```
indicatorResults[]  → AnalysisPanel "보조지표" 섹션
                       indicator_guide skill의 시그널 결과
                       indicatorName으로 그룹핑 (예: "RSI Signal Guide")

strategyResults[]   → AnalysisPanel "전략" 섹션
                       strategy skill의 분석 결과
                       strategyName으로 식별 (예: "엘리어트 파동")

patternSummaries[]  → AnalysisPanel "차트 패턴" 섹션
                       pattern skill의 차트 패턴 감지 결과
                       skillName으로 식별 (예: "Head and Shoulders")
```

---

## 타임프레임별 인디케이터 설정

분석 주기마다 MA/EMA 설정이 달라진다.

| 타임프레임 | RSI | MACD | 볼린저 | EMA |
|------------|-----|------|--------|-----|
| 1Min       | 14  | 12/26/9 | 20/2 | 9/21 |
| 5Min       | 14  | 12/26/9 | 20/2 | 20/60 |
| 15Min      | 14  | 12/26/9 | 20/2 | 20/60 |
| 1Hour      | 14  | 12/26/9 | 20/2 | 20/60 |
| 1Day       | 14  | 12/26/9 | 20/2 | 20/60 |

---

## 봉 개수 기준

```
타임프레임별 최초 로딩 봉 개수 (RSC)

1Min   → 200봉 (약 3.3시간)
5Min   → 288봉 (약 1일)
15Min  → 200봉 (약 2.5일)
1Hour  → 200봉 (약 1.2개월)
1Day   → 500봉 (약 2년)

스크롤 추가 로딩: 매번 200봉씩 prepend
```

---

## IndicatorResult 타입 규칙

### IndicatorResult 필드 추가 규칙

IndicatorResult에 새 인디케이터 필드를 추가하는 시점은
해당 인디케이터의 계산 함수 구현이 완료된 이후다.

❌ 금지
- 계산 함수 없이 타입 필드만 먼저 추가
- 빈 배열(`[]`) 또는 빈 객체(`{}`)로 하드코딩
- TODO 주석으로 대체

✅ 올바른 순서
1. 계산 함수 구현 (예: calculateRSI)
2. 테스트 작성 및 통과 확인
3. IndicatorResult에 필드 추가
4. 호출부에서 실제 계산 결과 연결

### MA/EMA 기간별 결과 구조

MA/EMA 기간을 `ma20`, `ema60` 등 고정 필드로 정의하지 않는다.
기간별 데이터는 `Record<number, (number | null)[]>` 구조로 관리한다.

```typescript
// ❌ 금지
ema20: (number | null)[];
ema60: (number | null)[];

// ✅ 올바른 구조
ma: Record<number, (number | null)[]>;
ema: Record<number, (number | null)[]>;
```

---

## lib/chartColors.ts

차트에서 사용하는 모든 색상 상수를 정의한다.
UI 유틸리티 래퍼 레이어(`lib/`)에 위치한다.

```typescript
export const CHART_COLORS = {
    background, grid, text,
    bullish, bearish, neutral,
    volumeBullish, volumeBearish,
    period5, period10, period20, period60, period120, period200,
    bollingerUpper, bollingerMiddle, bollingerLower, bollingerBackground,
    macdLine, macdSignal, macdHistogramBullish, macdHistogramBearish,
    rsiLine, rsiOverbought, rsiOversold,
    dmiPlus, dmiMinus, dmiAdx,
    vwap,
} as const;

export function getPeriodColor(period: number): string;
```

### time.ts

```typescript
export const SECONDS_PER_DAY = 86400;
```

---

## 차트 오버레이 훅 규칙

보조지표 오버레이는 React 컴포넌트가 아닌 **커스텀 훅**으로 구현한다.

### 이유

오버레이는 DOM 요소를 렌더링하지 않는다.
기존 차트 인스턴스(`IChartApi`)에 시리즈를 추가/제거하는 사이드이펙트만 수행하므로 `return null` 컴포넌트보다 훅이 적합하다.

### 위치

```
src/components/chart/hooks/
```

### 훅 파라미터 패턴

```typescript
interface UseXxxOverlayParams {
    chartRef: RefObject<IChartApi | null>;
    bars: Bar[];
    indicators: IndicatorResult;
}
```

### 구현 규칙

```
- chart 소멸은 부모가 담당 → 훅에서 chart.remove() 호출 금지
- prevChartRef로 chart 인스턴스 변경 감지 → 변경 시 시리즈 refs 초기화
- Math.min(bars.length, data.length)로 인덱스 정합성 보장
- null 값은 WhitespaceData({ time })으로 변환
- 시리즈별 ON/OFF는 훅이 반환하는 toggle 함수로 제어
```

### 오버레이 목록

| 훅 | pane | 설명 |
|----|------|------|
| `useMAOverlay` | 0 (메인) | MA 실선 (기간별 ON/OFF) |
| `useEMAOverlay` | 0 (메인) | EMA 점선 (기간별 ON/OFF) |
| `useBollingerOverlay` | 0 (메인) | 볼린저 밴드 (3선 + 배경) |
| `useIchimokuOverlay` | 0 (메인) | 전환선/기준선/후행스팬/선행스팬A/선행스팬B (LineSeries 5개) + 구름대 (AreaSeries 2개) |
| `useRSIChart` | 동적 | RSI + 과매수/과매도선 |
| `useMACDChart` | 동적 | MACD 라인 + 시그널 + 히스토그램 |
| `useDMIChart` | 동적 | +DI / -DI / ADX |
| `useStochasticChart` | 동적 | %K / %D + 과매수/과매도선 |
| `useStochRSIChart` | 동적 | K / D + 과매수(0.8)/과매도(0.2)선 |
| `useCCIChart` | 동적 | CCI + 과매수(+100)/과매도(-100)/중앙(0)선 |

> **pane 인덱스 규칙**: 메인 pane(0)에는 캔들+오버레이만 표시한다.
> 하위 인디케이터(RSI, MACD 등)의 pane 번호는 **고정값이 아니라** 현재 활성화된 인디케이터 조합에 따라
> `StockChart.tsx`의 `useMemo`에서 동적으로 계산된다 (`FIRST_INDICATOR_PANE_INDEX` + 활성 순서).
> 비활성 인디케이터는 `INACTIVE_PANE_INDEX`를 부여받아 렌더링되지 않는다.

---

## Skills 시스템

### 개요

`/skills/` 디렉토리(및 하위 폴더)에 `.md` 파일을 추가하는 것만으로 새로운 분석 기법을 정의할 수 있다.
코드 수정 없이 자연어로 작성된 파일만으로 AI가 해당 기법에 맞춰 기술적 분석을 수행한다.

**디렉토리 위치**: 프로젝트 루트의 `/skills/` (src/ 밖)
**파일 읽기 책임**: `infrastructure/skills/loader.ts` (`FileSkillsLoader`). `domain/`은 파일 I/O를 하지 않는다.

### 파일 구조 (실제 파일 없이 폴더만)

```
skills/
├── patterns/
├── indicators/
├── strategies/
├── candlesticks/
└── support-resistance/
```

### Skill 타입

`type` 필드는 `'pattern'`, `'indicator_guide'`, `'strategy'`, `'candlestick'`, `'support_resistance'` 중 하나다.
`type`이 없는 경우 `undefined`로 처리된다.

| type | 설명 | 프롬프트 섹션 |
|---|---|---|
| `pattern` | 차트 패턴 감지 (헤드앤숄더, 이중천장 등) | "Pattern Analysis" |
| `indicator_guide` | 인디케이터 신호 가이드 | "Indicator Signal Guides" |
| `strategy` | 투자 전략 분석 (엘리어트 파동, 이동평균선 대순환 등) | "Strategy Analysis" |
| `candlestick` | 캔들스틱 패턴 해석 가이드 | "Candlestick Pattern Guides" |
| `support_resistance` | 지지/저항 분석 도구 (피봇 포인트, 피보나치 등) | "Support/Resistance Tool Guides" |
| (없음) | 기타 | "Active Skills" |

### 파일 형식

```markdown
---
name: string                  # skill 표시 이름 (indicatorResults[].indicatorName, strategyResults[].strategyName, patternSummaries[].skillName 등 해당 카테고리별 식별자로 사용)
description: string           # skill 설명
type: pattern | indicator_guide | strategy | candlestick | support_resistance  # 선택
category: string              # 선택. reversal_bullish | reversal_bearish | continuation_bullish | continuation_bearish | neutral
pattern: string               # type: pattern일 때 패턴 식별자
indicators: string[]          # 이 skill이 필요로 하는 인디케이터 목록
confidence_weight: number     # 0.0 ~ 1.0. 프롬프트 포함 여부와 강조도 결정
display:                      # 선택. 차트 표시 설정
  chart:
    show: boolean             # 기본 show/hide 여부 (기본값: false)
    type: line | marker | region  # 차트 표시 형태
    color: string             # 표시 색상 (CSS 색상값)
    label: string             # 차트에 표시할 라벨
---

## 분석 기준

(AI가 적용할 분석 기준을 자연어로 서술)

## AI 분석 지시

(AI에게 이 skill 적용 시 응답에 포함해야 할 내용 지시)
```

### Skill markdown 유효성 규칙

```
type 필드: 'pattern' | 'indicator_guide' | 'strategy' | 'candlestick' | 'support_resistance' 중 하나만 유효
  → 해당하지 않으면 type 필드를 생략 (undefined 처리)

필수 필드: name, description, indicators, confidence_weight
  → 누락 시 파싱 에러. 모든 필수 필드가 frontmatter와 body에 존재해야 함
```

### confidence_weight 적용 규칙

| 범위 | 프롬프트 처리 |
|---|---|
| `< 0.5` | 프롬프트에서 **완전 제외** |
| `0.5 ~ 0.8` | 프롬프트에 포함, `[중간 신뢰도]` 라벨 |
| `>= 0.8` | 프롬프트에 포함, `[높은 신뢰도]` 라벨로 강조 |

### Skill 타입 (domain)

infrastructure 레이어가 파싱한 skill 파일을 domain에 전달할 때 사용하는 타입.
domain은 이 타입만 받고 파일 경로나 원본 Markdown은 알지 못한다.

```typescript
// domain/types.ts

type ChartDisplayType = 'line' | 'marker' | 'region';

// skill frontmatter의 display.chart 설정을 담는 타입
interface SkillChartDisplay {
    show: boolean;
    type: ChartDisplayType;
    color: string;
    label: string;
}

// skill의 차트 표시 설정 (display 필드가 없는 경우 undefined)
interface SkillDisplay {
    chart: SkillChartDisplay;
}

type SkillType = 'pattern' | 'indicator_guide' | 'strategy' | 'candlestick' | 'support_resistance';

type SkillCategory =
    | 'reversal_bullish'
    | 'reversal_bearish'
    | 'continuation_bullish'
    | 'continuation_bearish'
    | 'neutral';

interface Skill {
    name: string;
    description: string;
    type?: SkillType;           // 'pattern' | 'indicator_guide' | 'strategy'
    category?: SkillCategory;   // skill 분류 (선택)
    pattern?: string;           // type='pattern'일 때 패턴 식별자 (예: 'double_top')
    indicators: string[];
    confidenceWeight: number;
    content: string;            // frontmatter 제거 후 순수 Markdown 본문
    display?: SkillDisplay;     // 차트 표시 설정 (선택)
}

// PatternResult: AI 분석 응답에서 패턴 감지 결과와 렌더링 설정을 함께 담는 타입
// skill의 display 설정이 renderConfig에 반영된다
// PatternSummary를 extends하여 중복 필드 선언 방지
interface PatternResult extends PatternSummary {
    renderConfig?: SkillChartDisplay;  // skill의 display.chart 설정이 그대로 복사됨
}
```

### Skills 적용 흐름

```
infrastructure/skills/loader.ts (FileSkillsLoader)
  → skills/ 디렉토리를 재귀적으로 탐색하여 모든 .md 파일 수집
  → 각 파일 파싱: YAML frontmatter → Skill 객체
  → Skill[] 반환

app/api/analyze/route.ts (또는 app/[symbol]/page.tsx)
  → FileSkillsLoader.loadSkills() 호출
  → Skill[]를 buildAnalysisPrompt()에 전달

domain/analysis/prompt.ts
  → buildAnalysisPrompt(symbol, bars, indicators, skills)
  → confidenceWeight < 0.5인 항목 필터링
  → type='indicator_guide' skills → "Indicator Signal Guides" 섹션
  → type='pattern' skills → "Pattern Analysis" 섹션
  → type='candlestick' skills → "Candlestick Pattern Guides" 섹션
  → type='support_resistance' skills → "Support/Resistance Tool Guides" 섹션
  → type='strategy' skills → "Strategy Analysis" 섹션
  → 나머지 skills (type 없음) → "Active Skills" 섹션
  → confidenceWeight >= 0.8이면 "[높은 신뢰도]" 라벨 추가
  → 순수 함수 — 파일 접근 없음

infrastructure/ai/claude.ts
  → 완성된 프롬프트로 Claude API 호출
  → AnalysisResponse 파싱 후 반환
```

### indicators 필드와 계산 흐름의 관계

skill의 `indicators` 필드는 **해당 skill이 분석에 필요로 하는 인디케이터 목록**이다.
현재 이 필드는 파싱 후 `Skill.indicators: string[]`에 저장되지만,
프롬프트 빌드 로직(`buildAnalysisPrompt`)에서 직접 소비되지는 않는다.
인디케이터 값은 `IndicatorResult` 전체가 프롬프트에 포함되어 AI가 참조한다.

```typescript
// 예시 (향후 최적화 용도)
const activeSkills = allSkills.filter(s => s.confidenceWeight >= 0.5);
const requiredIndicators = new Set(activeSkills.flatMap(s => s.indicators));

// requiredIndicators에 없는 인디케이터는 계산 생략 가능
// (현재는 전체 계산 후 전달하는 단순 구현)
```

### 패턴 skill 예시

```markdown
---
name: 이중고점
description: 비슷한 가격대에서 두 번의 고점이 형성되는 하락 반전 패턴
type: pattern
pattern: double_top
indicators: []
confidence_weight: 0.75
display:
  chart:
    show: false
    type: marker
    color: '#ef4444'
    label: 이중고점
---

## 분석 기준

- 비슷한 가격대에서 두 번의 고점이 형성된다 (3% 이내)
- 두 고점 사이에 뚜렷한 저점(넥라인)이 있어야 한다
- 두 번째 고점에서 거래량 감소 여부 (신뢰도 보강 요소)

## AI 분석 지시

패턴 감지 시 다음을 포함해 분석한다:
- 두 고점 가격 수준과 차이 비율
- 넥라인 위치와 현재 가격 대비 이탈 여부
- 목표 하락폭
```

### 신뢰도 개선 계획

```
1단계: 분석 결과 수집
   → 분석 시점의 bars, indicators, 분석 결과를 저장

2단계: 정확도 측정
   → 분석 이후 실제 가격 움직임과 예측 방향 비교
   → skill별 적중률 산출

3단계: 피드백 반영
   → 적중률 낮은 skill의 confidence_weight 조정 제안
   → 커뮤니티 리뷰를 통한 skill 업데이트
```

---

## AI Prompt Design Principles

`domain/analysis/prompt.ts`와 `infrastructure/ai/*`를 수정할 때는 다음 원칙을 준수한다.

### 1. Determinism (결정성)

- AI provider 호출 시 `temperature`와 `top_p`는 반드시 명시적으로 전달한다.
  기본값: `temperature: 0`, `top_p: 0.95`
  환경변수로 override: `GEMINI_TEMPERATURE` / `GEMINI_TOP_P` / `CLAUDE_TEMPERATURE` / `CLAUDE_TOP_P`
- 동일 입력 → 동일 프롬프트 문자열을 보장한다.
  `buildAnalysisPrompt`는 입력 `skills` 배열의 순서와 무관하게 byte-identical 결과를 반환해야 한다.
  → active skills를 `skill.name` 기준 `localeCompare` 정렬한 뒤 type별 그룹화.
- `Object.entries`, `Set`, `Map`을 사용할 때 삽입 순서가 안정적인지 확인한다.

### 2. Grounding & Anti-fabrication (근거 기반)

- 프롬프트에 raw 수치(지표값, 패턴 검출 결과, 최근 봉)를 사전 계산하여 주입한다. AI에게 계산을 맡기지 않는다.
- 스키마 예시 값(150.00 등)은 "예시일 뿐 복사 금지"임을 프롬프트 내 `SCHEMA_PREFACE`로 명시한다.
- "데이터 부족 시 추측 금지" 규칙은 system prompt와 `## Analysis Intent` 블록 양쪽에 둔다.

### 3. Structured Output (구조화 출력)

- **Gemini**: 반드시 `generationConfig.responseMimeType: "application/json"`을 전달한다.
  향후 `responseSchema`를 추가할 수 있도록 `AnalysisResponse` 타입 변경 시 호환성을 고려한다.
- **Claude**: 향후 `tools` + `tool_choice` 기반 structured output으로 확장 가능.
- `stripMarkdownCodeBlock` 후처리는 방어 차원으로 유지하되, 1차가 아닌 2차 방어선이다.

### 4. System Prompt vs User Prompt 분리

| 위치 | 역할 |
|---|---|
| `AI_SYSTEM_PROMPT` (`infrastructure/ai/utils.ts`) | 페르소나, 결정성, anti-fabrication, 출력 형식, 한국어·존댓말 규칙 — 모든 호출에 공통인 행동 규약 |
| `## Analysis Intent` 블록 (user prompt 상단) | 현재 호출의 데이터 grounding 규칙과 출력 의도 재확인 |
| `RESPONSE_LANGUAGE_INSTRUCTION` (user prompt 하단) | 한국어 출력 규칙 상세 지시 |

한국어 출력처럼 강하게 강제해야 하는 항목은 **system prompt + 상단 intent + 하단 instruction** 세 곳에 모두 명시한다.
긴 프롬프트에서 attention decay를 방어하는 다중 레이어 reinforcement다.

### 5. 결정적 Skills 정렬

- `infrastructure/skills/loader.ts`의 `readdir`는 OS·inode 순서를 보장하지 않는다.
- `buildAnalysisPrompt`가 active skills를 `skill.name` 기준으로 정렬하여 호출자 의존성을 제거한다.
- 새 skill 타입 그룹이 추가될 때 그룹 내 정렬이 유지되는지 확인한다.

### 6. 한국어 출력 규칙

응답 JSON의 모든 자유 텍스트 필드(`summary`, `description`, `reason`, `basis`, `condition`,
`positionAnalysis`, `entry`, `exit`, `riskReward`)는 한국어 존댓말이다.

이 규칙은 다음 세 곳에 명시한다. 하나라도 누락하지 않는다:

1. `AI_SYSTEM_PROMPT` — "All text content … MUST be written in Korean (한국어)"
2. `ANALYSIS_INTENT_BLOCK` — "All text fields MUST be Korean (한국어)"
3. `RESPONSE_LANGUAGE_INSTRUCTION` — 필드별 상세 지시

### 7. 회귀 방지

- `prompt.ts`의 섹션 순서를 변경할 때는 `src/__tests__/domain/analysis/prompt.test.ts`의
  position assertion(예: Analysis Guidelines → Analysis Request 순서) 이 깨지지 않는지 확인한다.
- AI provider 호출 옵션을 변경할 때는 `src/__tests__/infrastructure/ai/{gemini,claude,utils}.test.ts`의
  spy 검증을 함께 갱신한다.
