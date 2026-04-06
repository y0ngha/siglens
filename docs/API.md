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

---

## FMP (Financial Modeling Prep) Market Data API

공식 문서: https://site.financialmodelingprep.com/developer/docs

Base URL: `https://financialmodelingprep.com/stable`

### 인증

```
Query Parameter: apikey={FMP_API_KEY}
```

환경변수:
```
FMP_API_KEY=
```

### 플랜 제한 (Free Tier)

```
지연:     15분
데이터:   히스토리컬 OHLCV
```

---

## FMP 사용 엔드포인트

### 1. Historical Chart (Intraday: 1Min ~ 1Hour)

```
GET /stable/historical-chart/{timeframe}?symbol={symbol}&apikey={key}
```

**Timeframe 매핑**

| Siglens Timeframe | FMP Timeframe |
|---|---|
| 1Min | 1min |
| 5Min | 5min |
| 15Min | 15min |
| 1Hour | 1hour |

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| symbol | string | ✅ | 종목 심볼 (path가 아닌 query param) |
| apikey | string | ✅ | FMP API 키 |
| from | string | - | YYYY-MM-DD 형식 시작일 |
| to | string | - | YYYY-MM-DD 형식 종료일 |

**Request 예시**

```
GET /stable/historical-chart/1min?symbol=AAPL&apikey={key}&from=2024-01-01&to=2024-01-15
```

**Response**

```typescript
interface FmpBar {
    date: string;    // "2024-01-15 09:30:00" (UTC, timezone 정보 없음)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// 응답: FmpBar[] (newest-first 정렬 → ascending으로 reverse 필요)
```

**주의사항**
- 응답은 newest-first 정렬 → `toReversed()` 하여 ascending order 반환
- `date` 필드는 timezone 정보 없음 → UTC로 간주 (`+ ' UTC'` 파싱)
- `vwap` 필드 없음 (Alpaca 전용)
- `before` 파라미터 → `to` 쿼리 파라미터로 변환 (ISO string → "YYYY-MM-DD")

---

### 2. Historical Price EOD Full (Daily: 1Day)

```
GET /stable/historical-price-eod/full?symbol={symbol}&apikey={key}
```

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| symbol | string | ✅ | 종목 심볼 |
| apikey | string | ✅ | FMP API 키 |
| from | string | - | YYYY-MM-DD 형식 시작일 |
| to | string | - | YYYY-MM-DD 형식 종료일 |

**Request 예시**

```
GET /stable/historical-price-eod/full?symbol=AAPL&apikey={key}&from=2023-01-01&to=2024-01-15
```

**Response**

```typescript
interface FmpDailyBar {
    date: string;    // "2025-02-04" (YYYY-MM-DD)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// 응답: FmpDailyBar[] (newest-first 정렬 → ascending으로 reverse 필요)
```

**주의사항**
- Daily 전용 엔드포인트 — intraday(`historical-chart`) 와는 별도
- `date` 필드는 `YYYY-MM-DD` 형식 (시간 없음)
- 응답은 newest-first 정렬 → `toReversed()` 하여 ascending order 반환

---

## Market Data Provider 선택

```bash
# MARKET_DATA_PROVIDER 환경변수로 provider 선택
# 미설정 또는 unknown 값이면 기본값 fmp 사용
MARKET_DATA_PROVIDER=fmp     # fmp | alpaca (기본값: fmp)
```

`createMarketDataProvider()` 팩토리 함수가 환경변수를 읽어 적절한 Provider 인스턴스를 반환한다.

---

## 환경변수 전체 목록

```bash
# Market Data Provider (선택 — 기본값: fmp)
MARKET_DATA_PROVIDER=        # fmp | alpaca

# FMP API (MARKET_DATA_PROVIDER=fmp 시 필수)
FMP_API_KEY=

# Alpaca API (MARKET_DATA_PROVIDER=alpaca 시 필수)
ALPACA_API_KEY=
ALPACA_API_SECRET=

# AI Provider (필수)
AI_PROVIDER=claude          # claude | gemini (기본값: claude)
ANTHROPIC_API_KEY=          # claude 사용 시 필수
GEMINI_API_KEY=             # gemini 사용 시 필수

# Upstash Redis (선택 — 미설정 시 캐시 없이 동작)
UPSTASH_REDIS_REST_URL=             # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=           # master 토큰 (읽기/쓰기)
UPSTASH_REDIS_REST_READONLY_TOKEN=  # readonly 토큰 (읽기 전용, 없으면 master 토큰 사용)
```

`.env.local`에 작성. 절대 커밋하지 않는다.