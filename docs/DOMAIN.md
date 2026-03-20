# Domain

## 개요

`domain/`은 외부 의존성이 없는 순수 TypeScript 함수만 포함한다.
외부 라이브러리(technicalindicators 포함) import 금지.
모든 계산 로직은 직접 구현한다.

---

## 공통 타입

```typescript
// domain/types.ts

export interface Bar {
    time: number;   // Unix timestamp (초)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;  // Alpaca 제공
}

export interface IndicatorResult {
    rsi: (number | null)[];
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
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

export interface PatternResult {
    type: PatternType;
    confidence: number;       // 0 ~ 1
    startIndex: number;
    endIndex: number;
}

export type PatternType =
    | 'head_and_shoulders'
    | 'inverse_head_and_shoulders'
    | 'ascending_wedge'
    | 'descending_wedge'
    | 'double_top'
    | 'double_bottom';
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

초기 slowPeriod + signalPeriod - 1개 구간 = null
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
알고리즘:
1. 첫 번째 값 = 초기 period개의 SMA
2. multiplier = 2 / (period + 1)
3. EMA = close * multiplier + prevEMA * (1 - multiplier)

초기 period - 1개 구간 = null
```

---

## 패턴 감지 명세

### 감지 대상 패턴

```
head_and_shoulders          헤드앤숄더 (하락 반전)
inverse_head_and_shoulders  역헤드앤숄더 (상승 반전)
ascending_wedge             상승쐐기 (하락 반전)
descending_wedge            하락쐐기 (상승 반전)
double_top                  이중천장 (하락 반전)
double_bottom               이중바닥 (상승 반전)
```

### confidence 기준

```
0.8 이상  → 높은 신뢰도 (AI 분석에 강조 포함)
0.5 ~ 0.8 → 중간 신뢰도 (AI 분석에 참고로 포함)
0.5 미만  → 낮은 신뢰도 (AI 분석에 미포함)
```

---

## AI 프롬프트 구성 명세

### 입력 데이터

```typescript
interface AnalysisInput {
    symbol: string;
    timeframe: string;
    bars: Bar[];              // 최근 N개
    indicators: IndicatorResult;
    patterns: PatternResult[];
}
```

### 프롬프트 구조

```
1. 현재 시장 상황 요약 (현재가, 변화율, 거래량)
2. 인디케이터 수치 (RSI, MACD, 볼린저, DMI)
3. 감지된 패턴 (confidence 0.5 이상만)
4. 분석 요청
```

### 응답 형식 (JSON)

```typescript
interface AnalysisResponse {
    summary: string;          // 종합 분석 요약
    trend: 'bullish' | 'bearish' | 'neutral';
    signals: Signal[];
    riskLevel: 'low' | 'medium' | 'high';
    keyLevels: {
        support: number[];
        resistance: number[];
    };
}

interface Signal {
    type: string;             // 예: "RSI 과매수", "MACD 골든크로스"
    description: string;
    strength: 'strong' | 'moderate' | 'weak';
}
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

### MA/EMA는 Record<number, ...> 구조를 사용할 것

MA/EMA 기간을 `ma20`, `ema60` 등 고정 필드로 정의하지 않는다.
기간별 데이터는 `Record<number, (number | null)[]>` 구조로 관리한다.

```typescript
// ❌ 금지
ma20: (number | null)[];
ema60: (number | null)[];

// ✅ 올바른 방식
ma: Record<number, (number | null)[]>;
ema: Record<number, (number | null)[]>;
```

### 계산 함수가 없는 상태에서 타입에 필드를 미리 추가하지 말 것

계산 함수 구현이 완료된 후 타입에 필드를 추가한다.
구현되지 않은 함수를 위해 빈 배열(`[]`)이나 빈 객체(`{}`)를 하드코딩하는 것은
TODO 주석과 함께 이슈 번호를 명시해야 한다.

```typescript
// ✅ 구현 전 임시 처리 방식
ma: {}, // TODO: #9 (MA 계산 구현) 완료 후 채워질 예정
ema: {}, // TODO: #9 (EMA 계산 구현) 완료 후 채워질 예정
```