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
`type: pattern`인 skill 파일이 활성화되면 AI가 해당 패턴 기준에 따라 직접 감지한다.
별도의 도메인 감지 함수는 존재하지 않는다.

---

## AI 프롬프트 구성 명세

### 입력 데이터

```typescript
interface AnalysisInput {
    symbol: string;
    timeframe: string;
    bars: Bar[];
    indicators: IndicatorResult;
    skills: SkillDefinition[];   // app 레이어에서 파싱 후 전달
}
```

### 프롬프트 구조

```
1. 현재 시장 상황 요약 (현재가, 변화율, 거래량)
2. 인디케이터 수치 (RSI, MACD, 볼린저, DMI)
3. skill 기반 분석 지시 (각 SkillDefinition의 body + 계산된 인디케이터 수치 포함)
4. 분석 요청 및 응답 형식 지시
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

interface KeyLevels {
    support: number[];
    resistance: number[];
}

interface Signal {
    type: SignalType;
    description: string;
    strength: SignalStrength;
}

// skill 기반 분석 결과. skill 이름과 해당 skill이 감지한 Signal 목록을 묶는다.
interface SkillSignal {
    skillName: string;
    signals: Signal[];
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
    chart: IChartApi | null;
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
**파일 읽기 책임**: `app/` 레이어 (RSC). `domain/`은 파일 I/O를 하지 않는다.

### 파일 구조

```
skills/
├── rsi-divergence.md
├── volume-spread.md
├── pattern-double-top.md
└── ...
```

### Skill 타입 목록

`type` 필드는 skill의 성격을 분류한다. 현재 정의된 타입:

| type | 설명 | `pattern` 필드 |
|---|---|---|
| `pattern` | 차트 패턴 감지 (헤드앤숄더, 이중천장 등) | 필수 |
| `indicator_analysis` | 인디케이터 해석 기법 (RSI 다이버전스 등) | 불필요 |
| `strategy` | 복합 조건 기반 매매 전략 | 불필요 |

`type: pattern`이 아닌 경우 `pattern` 필드는 생략한다.

### 파일 형식

```markdown
---
name: string                  # skill 표시 이름 (SkillSignal.skillName에 사용)
type: pattern | indicator_analysis | strategy
pattern?: string              # type: pattern일 때만 필수. 감지 대상 패턴 식별자
indicators: string[]          # 이 skill이 필요로 하는 인디케이터 목록
                              # (예: [rsi], [macd, volume], [])
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
| `0.5 ~ 0.8` | 프롬프트에 포함, 참고 수준으로 제시 |
| `>= 0.8` | 프롬프트에 포함, 높은 신뢰도로 강조 |

### SkillDefinition 타입

app 레이어가 파싱한 skill 파일을 domain에 전달할 때 사용하는 타입.
domain은 이 타입만 받고 파일 경로나 원본 Markdown은 알지 못한다.

```typescript
// domain/types.ts

type SkillType = 'pattern' | 'indicator_analysis' | 'strategy';

interface SkillDefinition {
    name: string;
    type: SkillType;
    pattern?: string;           // type: pattern일 때만 존재
    indicators: string[];
    confidenceWeight: number;
    analysisBody: string;       // frontmatter 제거 후 순수 Markdown 본문
}
```

### Skills 적용 흐름

```
app/[symbol]/page.tsx (RSC)
  → fs.readdir('skills/')로 모든 .md 파일 목록 확인
  → 각 파일 파싱: frontmatter → SkillDefinition
  → confidenceWeight < 0.5인 항목 필터링
  → 남은 SkillDefinition[] 을 buildAnalysisPrompt()에 전달

domain/analysis/prompt.ts
  → buildAnalysisPrompt(input: AnalysisInput): string
  → SkillDefinition[]를 순회하며 각 skill의 analysisBody를 프롬프트에 포함
  → confidenceWeight >= 0.8이면 "높은 신뢰도" 강조 문구 추가
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
// app/[symbol]/page.tsx (RSC) — 예시
const activeSkills = allSkills.filter(s => s.confidenceWeight >= 0.5);
const requiredIndicators = new Set(activeSkills.flatMap(s => s.indicators));

// requiredIndicators에 없는 인디케이터는 계산 생략 가능
// (현재는 전체 계산 후 전달하는 단순 구현도 허용)
```

### 패턴 skill 예시

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

### indicator_analysis skill 예시

```markdown
---
name: RSI 다이버전스
type: indicator_analysis
indicators: [rsi]
confidence_weight: 0.8
---

## 분석 기준

### 강세 다이버전스 (매수 신호)
- 가격이 더 낮은 저점을 만들지만 RSI는 더 높은 저점을 만들 때
- 신뢰도: 직전 저점 대비 RSI 차이가 클수록 높음

### 약세 다이버전스 (매도 신호)
- 가격이 더 높은 고점을 만들지만 RSI는 더 낮은 고점을 만들 때

## AI 분석 지시

위 조건 충족 시 다음을 포함해 분석한다:
- 다이버전스 발생 시점과 강도
- 추세 전환 가능성 (높음/중간/낮음)
- 진입 시 참고할 지지/저항 레벨
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