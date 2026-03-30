# API

## Alpaca Market Data API

공식 문서: https://docs.alpaca.markets/reference/stockbars

Base URL: `https://data.alpaca.markets/v2`

### 인증

```
Header: APCA-API-KEY-ID: {API_KEY}
Header: APCA-API-SECRET-KEY: {API_SECRET}
```

환경변수:
```
ALPACA_API_KEY=
ALPACA_API_SECRET=
```

### 플랜 제한 (Free Tier)

```
거래소:   IEX만 (전체 거래소 대비 거래량 약 28~30% 낮음)
지연:     15분
API 호출: 200회/분
데이터:   7년+ 히스토리컬
```

---

## 사용하는 엔드포인트

### 1. Historical Bars (단일 심볼)

```
GET /v2/stocks/{symbol}/bars
```

**공식 문서**: https://docs.alpaca.markets/reference/stockbarsingle-1

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| timeframe | string | ✅ | 1Min, 5Min, 15Min, 1Hour, 1Day |
| start | string | - | ISO 8601 (예: 2024-01-15T09:30:00Z) |
| end | string | - | ISO 8601 |
| limit | number | - | 최대 10000, 기본 1000 |
| feed | string | - | iex (Free Tier 고정) |
| sort | string | - | asc (기본) |

**Request 예시**

```
GET /v2/stocks/AAPL/bars?timeframe=1Min&limit=200&feed=iex&sort=asc
```

**Response**

```typescript
interface AlpacaBarsResponse {
    bars: AlpacaBar[];
    symbol: string;
    next_page_token: string | null;
}

interface AlpacaBar {
    t: string;    // ISO 8601 timestamp
    o: number;    // open
    h: number;    // high
    l: number;    // low
    c: number;    // close
    v: number;    // volume
    vw: number;   // VWAP (Alpaca 제공)
    n: number;    // 체결 건수
}
```

**주의사항**
- `next_page_token`이 null이 아니면 페이지네이션 필요
- Free Tier는 `feed=iex` 고정 (생략 시도 가능하나 명시 권장)
- 거래량(`v`)은 IEX 기준이므로 전체 시장 대비 낮음

---

### 2. Latest Bar (단일 심볼)

```
GET /v2/stocks/{symbol}/bars/latest
```

**공식 문서**: https://docs.alpaca.markets/reference/stocklatestbarsingle-1

현재가 확인 또는 실시간 업데이트 시 사용.

**Response**

```typescript
interface AlpacaLatestBarResponse {
    bar: AlpacaBar;
    symbol: string;
}
```

---

### 3. Snapshot (단일 심볼)

```
GET /v2/stocks/{symbol}/snapshot
```

**공식 문서**: https://docs.alpaca.markets/reference/stocksnapshotsingle

현재가, 당일 봉, 전일 봉을 한 번에 조회.

**Response**

```typescript
interface AlpacaSnapshotResponse {
    latestTrade: AlpacaTrade;
    latestQuote: AlpacaQuote;
    minuteBar: AlpacaBar;
    dailyBar: AlpacaBar;
    prevDailyBar: AlpacaBar;
}
```

---

## 환경변수 전체 목록

```bash
# Alpaca API (필수)
ALPACA_API_KEY=
ALPACA_API_SECRET=

# AI Provider (필수)
AI_PROVIDER=claude          # claude | gemini (기본값: claude)
ANTHROPIC_API_KEY=          # claude 사용 시 필수
GEMINI_API_KEY=             # gemini 사용 시 필수
```

`.env.local`에 작성. 절대 커밋하지 않는다.