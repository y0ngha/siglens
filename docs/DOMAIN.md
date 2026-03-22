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
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    rsi: (number | null)[];
    vwap: (number | null)[];
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

### 감지 방식

패턴 감지는 알고리즘이 아닌 AI + skills 파일 기반으로 수행한다.

```
skills/*.md (type: pattern) 파싱
  → frontmatter의 pattern 필드로 activePatterns[] 결정
  → buildAnalysisPrompt에 skill 본문(분석 기준 + AI 분석 지시) 포함
  → AI가 bars 데이터와 skill 기준을 대조하여 패턴 감지
  → AnalysisResponse에 결과 포함
```

패턴 결과는 AI 응답(`AnalysisResponse.signals`)에서 도출된다.
별도의 도메인 감지 함수는 존재하지 않는다.

패턴 skill 파일 예시 (`skills/pattern-double-top.md`):

```markdown
---
name: 이중천장
type: pattern
pattern: double_top
indicators: []
confidence_weight: 0.75
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

## Skills 시스템

### 개요

`/skills/*.md` 파일을 추가하는 것만으로 새로운 분석 기법을 정의할 수 있다.
코드 수정 없이 자연어로 작성된 파일만으로 AI가 해당 기법에 맞춰 기술적 분석을 수행한다.

### 파일 구조

```
skills/
├── rsi-divergence.md       RSI 다이버전스 분석
├── volume-spread.md        거래량 스프레드 분석
├── wyckoff.md              와이코프 이론
└── my-strategy.md          커스텀 전략
```

### 파일 형식

```markdown
---
name: RSI 다이버전스
description: 가격과 RSI의 방향이 반대일 때 추세 전환 신호를 감지한다
indicators: [rsi]
confidence_weight: 0.8
---

## 분석 기준

### 강세 다이버전스 (매수 신호)
- 가격이 더 낮은 저점을 만들지만 RSI는 더 높은 저점을 만들 때
- 신뢰도: 직전 저점 대비 RSI 차이가 클수록 높음

### 약세 다이버전스 (매도 신호)
- 가격이 더 높은 고점을 만들지만 RSI는 더 낮은 고점을 만들 때
- 신뢰도: 직전 고점 대비 RSI 차이가 클수록 높음

## AI 분석 지시

위 조건 충족 시 다음을 포함해 분석한다:
- 다이버전스 발생 시점과 강도
- 추세 전환 가능성 (높음/중간/낮음)
- 진입 시 참고할 지지/저항 레벨
```

### Skills 적용 흐름

```
/skills/*.md 파일 읽기
  → frontmatter에서 필요한 인디케이터 목록 파악
  → 해당 인디케이터 계산 (domain/indicators/)
  → AI 프롬프트에 skill 내용 + 계산 결과 포함
  → AI가 skill 기준에 맞춰 분석 수행
  → AnalysisResponse에 skill별 결과 포함
```

### 신뢰도 개선 계획

```
1단계: 분석 결과 수집
   → 분석 시점의 bars, indicators, 분석 결과를 저장

2단계: 정확도 측정
   → 분석 이후 실제 가격 움직임과 예측 방향 비교
   → skill별 적중률 산출

3단계: 피드백 반영
   → 적중률 낮은 skill의 기준값 조정 제안
   → 커뮤니티 리뷰를 통한 skill 업데이트
```