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

export type Bar = {
    time: number;   // Unix timestamp (초)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number;  // Alpaca 제공
};

export interface IndicatorResult {
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    rsi: (number | null)[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
}

export type MACDResult = {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
};

export type BollingerResult = {
    upper: number | null;
    middle: number | null;
    lower: number | null;
};

export type DMIResult = {
    diPlus: number | null;
    diMinus: number | null;
    adx: number | null;
};
```

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

export const MA_DEFAULT_PERIODS = [20] as const;
export const EMA_DEFAULT_PERIODS = [9, 20, 21, 60] as const;
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
기본 기간: [9, 20, 21, 60]

알고리즘:
1. 첫 번째 값 = 초기 period개의 SMA
2. multiplier = 2 / (period + 1)
3. EMA = close * multiplier + prevEMA * (1 - multiplier)

초기 period - 1개 구간 = null
```

### MA (Simple Moving Average)

```
기본 기간: [20]

알고리즘:
1. MA = 최근 period개 close의 단순 평균

초기 period - 1개 구간 = null
```

### calculateIndicators 통합 함수

```typescript
// domain/indicators/index.ts

function calculateIndicators(bars: Bar[]): IndicatorResult {
    // MA_DEFAULT_PERIODS, EMA_DEFAULT_PERIODS 상수를 사용해
    // 각 기간별로 계산 후 Record<number, (number | null)[]> 형태로 반환
}
```

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
| `pattern-head-and-shoulders.md` | head_and_shoulders (하락 반전) | 0.8 |
| `pattern-inverse-head-and-shoulders.md` | inverse_head_and_shoulders (상승 반전) | 0.8 |
| `pattern-double-top.md` | double_top (하락 반전) | 0.75 |
| `pattern-double-bottom.md` | double_bottom (상승 반전) | 0.75 |
| `pattern-ascending-wedge.md` | ascending_wedge (하락 반전) | 0.7 |
| `pattern-descending-wedge.md` | descending_wedge (상승 반전) | 0.7 |

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
5. 인디케이터 수치 (RSI, MACD, 볼린저, DMI)
6. 패턴 분석 (type='pattern' skills, confidence >= 0.5)
7. 활성화된 Skills (type!='pattern' skills, confidence >= 0.5)
8. 분석 요청 및 JSON 응답 형식 지시
```

### 응답 형식 (JSON)

```typescript
type Trend = 'bullish' | 'bearish' | 'neutral';
type RiskLevel = 'low' | 'medium' | 'high';
type SignalStrength = 'strong' | 'moderate' | 'weak';
type SignalType =
    | 'rsi_overbought'
    | 'rsi_oversold'
    | 'macd_golden_cross'
    | 'macd_dead_cross'
    | 'bollinger_upper_breakout'
    | 'bollinger_lower_breakout'
    | 'bollinger_squeeze'
    | 'dmi_bullish_trend'
    | 'dmi_bearish_trend'
    | 'pattern'
    | 'skill';

interface Signal {
    type: SignalType;
    description: string;
    strength: SignalStrength;
}

interface SkillSignal {
    skillName: string;
    signals: Signal[];
}

interface KeyLevels {
    support: number[];
    resistance: number[];
}

interface AnalysisResponse {
    summary: string;
    trend: Trend;
    signals: Signal[];         // 인디케이터 기반 신호 (skill 무관)
    skillSignals: SkillSignal[]; // skill 기반 신호 (skill별로 그룹핑)
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
}
```

### signals vs skillSignals 구분 기준

```
signals[]      → 인디케이터 수치 자체에서 도출되는 신호
                 (RSI 과매수, MACD 크로스 등 skill 없이도 판단 가능한 것)

skillSignals[] → skill 파일의 분석 기준을 적용해야만 도출되는 신호
                 (RSI 다이버전스, 볼린저 스퀴즈 전략, 패턴 감지 등)
                 skill 이름(skillName)으로 그룹핑
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

## domain/constants

### colors.ts

차트에서 사용하는 모든 색상 상수를 정의한다.

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
| `useMAOverlay` | 0 | MA 실선 (기간별 ON/OFF) |
| `useEMAOverlay` | 0 | EMA 점선 (기간별 ON/OFF) |
| `useBollingerOverlay` | 0 | 볼린저 밴드 (3선 + 배경) |
| `useRSIChart` | 2 | RSI + 과매수/과매도선 |
| `useMACDChart` | 3 | MACD 라인 + 시그널 + 히스토그램 |
| `useDMIChart` | 4 | +DI / -DI / ADX |

---

## Skills 시스템

### 개요

`/skills/*.md` 파일을 추가하는 것만으로 새로운 분석 기법을 정의할 수 있다.
코드 수정 없이 자연어로 작성된 파일만으로 AI가 해당 기법에 맞춰 기술적 분석을 수행한다.

**디렉토리 위치**: 프로젝트 루트의 `/skills/` (src/ 밖)
**파일 읽기 책임**: `infrastructure/skills/loader.ts` (`FileSkillsLoader`). `domain/`은 파일 I/O를 하지 않는다.

### 파일 구조

```
skills/
├── pattern-head-and-shoulders.md
├── pattern-inverse-head-and-shoulders.md
├── pattern-double-top.md
├── pattern-double-bottom.md
├── pattern-ascending-wedge.md
├── pattern-descending-wedge.md
└── ...
```

### Skill 타입

현재 `type` 필드는 `'pattern'`만 정의되어 있다.
`type`이 `'pattern'`이 아닌 경우 `undefined`로 처리된다.

| type | 설명 | 프롬프트 섹션 |
|---|---|---|
| `pattern` | 차트 패턴 감지 (헤드앤숄더, 이중천장 등) | "패턴 분석" |
| (없음) | 인디케이터 해석, 전략 등 | "활성화된 Skills" |

### 파일 형식

```markdown
---
name: string                  # skill 표시 이름 (SkillSignal.skillName에 사용)
description: string           # skill 설명
type: pattern                 # 선택. 현재 pattern만 존재
pattern: string               # type: pattern일 때 패턴 식별자
indicators: string[]          # 이 skill이 필요로 하는 인디케이터 목록
confidence_weight: number     # 0.0 ~ 1.0. 프롬프트 포함 여부와 강조도 결정
---

## 분석 기준

(AI가 적용할 분석 기준을 자연어로 서술)

## AI 분석 지시

(AI에게 이 skill 적용 시 응답에 포함해야 할 내용 지시)
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

interface Skill {
    name: string;
    description: string;
    type?: 'pattern';           // pattern일 때만 존재
    indicators: string[];
    confidenceWeight: number;
    content: string;            // frontmatter 제거 후 순수 Markdown 본문
}
```

### Skills 적용 흐름

```
infrastructure/skills/loader.ts (FileSkillsLoader)
  → fs.readdir('skills/')로 모든 .md 파일 목록 확인
  → 각 파일 파싱: YAML frontmatter → Skill 객체
  → Skill[] 반환

app/api/analyze/route.ts (또는 app/[symbol]/page.tsx)
  → FileSkillsLoader.loadSkills() 호출
  → Skill[]를 buildAnalysisPrompt()에 전달

domain/analysis/prompt.ts
  → buildAnalysisPrompt(symbol, bars, indicators, skills)
  → confidenceWeight < 0.5인 항목 필터링
  → type='pattern' skills → "패턴 분석" 섹션
  → 나머지 skills → "활성화된 Skills" 섹션
  → confidenceWeight >= 0.8이면 "[높은 신뢰도]" 라벨 추가
  → 순수 함수 — 파일 접근 없음

infrastructure/ai/claude.ts
  → 완성된 프롬프트로 Claude API 호출
  → AnalysisResponse 파싱 후 반환
```

### indicators 필드와 계산 흐름의 관계

skill의 `indicators` 필드는 **해당 skill이 분석에 필요로 하는 인디케이터 목록**이다.
app 레이어는 활성화된 모든 skill의 `indicators`를 합산해
불필요한 인디케이터를 계산하지 않도록 최적화할 수 있다.

```typescript
// 예시
const activeSkills = allSkills.filter(s => s.confidenceWeight >= 0.5);
const requiredIndicators = new Set(activeSkills.flatMap(s => s.indicators));

// requiredIndicators에 없는 인디케이터는 계산 생략 가능
// (현재는 전체 계산 후 전달하는 단순 구현도 허용)
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