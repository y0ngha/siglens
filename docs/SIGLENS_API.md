# Siglens 내부 API

Next.js Route Handler로 구현된 내부 API 엔드포인트 명세.

외부 API(Alpaca, Claude)는 `docs/API.md` 참고.

---

## 공통

- Base URL: `/api`
- 요청/응답 Content-Type: `application/json`
- 에러 응답 형식: `{ error: string }`

---

## GET /api/bars

차트 스크롤 시 과거 OHLCV 데이터를 추가 로딩한다.

### Query Parameters

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `symbol` | string | ✅ | 종목 코드 (예: `AAPL`) |
| `timeframe` | string | ✅ | `1Min` \| `5Min` \| `15Min` \| `1Hour` \| `1Day` |
| `limit` | number | - | 반환할 봉 수. 기본값 `500` |
| `before` | string | - | ISO 8601 타임스탬프. 이 시점 이전 데이터 반환 |

### Request 예시

```
GET /api/bars?symbol=AAPL&timeframe=1Min&limit=500&before=2024-01-15T09:30:00Z
```

### Response

```typescript
interface BarsResponse {
    bars: Bar[];        // domain/types.ts의 Bar 타입
    hasMore: boolean;   // 더 불러올 데이터 존재 여부
}
```

```json
{
    "bars": [
        { "time": 1705312200, "open": 185.1, "high": 185.5, "low": 184.9, "close": 185.3, "volume": 12345 }
    ],
    "hasMore": true
}
```

### hasMore 판단 기준

내부적으로 `limit + 1`개를 요청해 실제 반환 수가 `limit`을 초과하면 `hasMore: true`.

### 에러 응답

| 상태 코드 | 사유 |
|-----------|------|
| `400` | `symbol` 또는 `timeframe` 누락 |
| `400` | `timeframe` 값이 허용 목록에 없음 |

---

## POST /api/analyze

주어진 봉 데이터와 인디케이터를 바탕으로 AI 종합 분석 리포트를 생성한다.

### Request Body

```typescript
interface AnalyzeRequest {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}
```

```json
{
    "symbol": "AAPL",
    "bars": [...],
    "indicators": {
        "macd": [...],
        "bollinger": [...],
        "dmi": [...],
        "rsi": [...],
        "vwap": [...],
        "ma": {},
        "ema": {}
    }
}
```

### Response

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

interface KeyLevel {
    price: number;
    reason: string;
}

interface KeyLevels {
    support: KeyLevel[];
    resistance: KeyLevel[];
    poc?: KeyLevel;
}

interface PriceTarget {
    price: number;
    basis: string;
}

interface PriceScenario {
    targets: PriceTarget[];
    condition: string;
}

interface PriceTargets {
    bullish: PriceScenario;
    bearish: PriceScenario;
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

// 차트 패턴 감지 결과 요약. skills/*.md 기반 패턴 분석 결과를 나타낸다.
interface PatternSummary {
    patternName: string;
    skillName: string;
    detected: boolean;
    trend: Trend;
    summary: string;
    keyPrices?: number[];
    timeRange?: { start: number; end: number };
}

// skill 기반 종합 분석 결과. 패턴 이외의 skill 분석 결과를 나타낸다.
interface SkillResult {
    skillName: string;
    trend: Trend;
    summary: string;
}

interface AnalysisResponse {
    summary: string;
    trend: Trend;
    signals: Signal[];
    skillSignals: SkillSignal[];
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
    priceTargets: PriceTargets;
    patternSummaries: PatternSummary[];
    skillResults: SkillResult[];
}
```

```json
{
    "summary": "AAPL은 현재 RSI 과매수 구간에 진입했으며 MACD 골든크로스가 형성 중입니다.",
    "trend": "bullish",
    "signals": [
        { "type": "rsi_overbought", "description": "RSI 72.3, 과매수 구간 진입", "strength": "moderate" }
    ],
    "skillSignals": [],
    "riskLevel": "medium",
    "keyLevels": {
        "support": [{ "price": 182.5, "reason": "이전 저점 지지선" }],
        "resistance": [{ "price": 188.0, "reason": "MA20 저항선" }],
        "poc": { "price": 185.0, "reason": "거래량 집중 구간" }
    },
    "priceTargets": {
        "bullish": {
            "targets": [{ "price": 192.0, "basis": "헤드앤숄더 패턴 목표가" }],
            "condition": "188.0 돌파 시"
        },
        "bearish": {
            "targets": [{ "price": 178.0, "basis": "지지선 이탈 후 다음 지지" }],
            "condition": "182.5 이탈 시"
        }
    },
    "patternSummaries": [],
    "skillResults": []
}
```

### 처리 흐름

```
POST /api/analyze
  → domain/analysis/prompt.ts → 프롬프트 구성
  → infrastructure/ai/factory.ts → AI_PROVIDER 환경변수로 프로바이더 선택 (claude | gemini)
  → infrastructure/ai/{claude|gemini}.ts → AI API 호출
  → AnalysisResponse 반환
```

---

## 타입 참조

전체 타입 정의는 `src/domain/types.ts` 참고.
