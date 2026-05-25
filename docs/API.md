# API

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

### 1. Historical Chart (Intraday: 5Min ~ 4Hour)

```
GET /stable/historical-chart/{timeframe}?symbol={symbol}&apikey={key}
```

**Timeframe 매핑**

| Siglens Timeframe | FMP Timeframe |
|---|---|
| 5Min | 5min |
| 15Min | 15min |
| 30Min | 30min |
| 1Hour | 1hour |
| 4Hour | 4hour |

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
- `vwap` 필드 없음
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

### 3. Quote (당일 실시간 시세)

```
GET /stable/quote?symbol={symbol}&apikey={key}
```

당일 거래 중 실시간 시세를 조회. EOD 엔드포인트가 당일 데이터를 포함하지 않는 장중에 호출하여 일봉 데이터에 append한다.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| symbol | string | ✅ | 종목 심볼 |
| apikey | string | ✅ | FMP API 키 |

**Response**

```typescript
interface FmpQuote {
    price: number;    // 현재가 (당일 bar의 close로 사용)
    open: number;     // 당일 시가
    dayHigh: number;  // 당일 고가
    dayLow: number;   // 당일 저가
    volume: number;   // 당일 거래량
    timestamp: number; // Unix timestamp (초 단위)
}

// 응답: FmpQuote[] (배열 형태, 단일 심볼이므로 [0]만 사용)
```

**주의사항**
- 장 마감 후 EOD 엔드포인트가 업데이트되면 당일 데이터가 중복될 수 있으므로, 마지막 EOD 봉의 time과 비교하여 중복 시 append 생략
- 실패(non-ok, 빈 배열, 네트워크 오류) 시 EOD 데이터만으로 graceful degradation

---

## 환경변수 전체 목록

```bash
# Market Data
FMP_API_KEY=

# AI
GEMINI_CHAT_API_KEY=
ANTHROPIC_CHAT_API_KEY=
OPENAI_CHAT_API_KEY=
GEMINI_CHAT_FREE_API_KEY=
TRANSLATE_API_KEY=
TRANSLATE_FREE_API_KEY=
TRANSLATE_MODEL=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
UPSTASH_REDIS_REST_READONLY_TOKEN=

# Database
DATABASE_URL=

# Authentication
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=
OAUTH_REDIRECT_BASE_URL=
OAUTH_TOKEN_ENCRYPTION_KEY=
LLM_API_KEY_ENCRYPTION_KEY=
OAUTH_STATE_HMAC_SECRET=
CRON_SECRET=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# Site
NEXT_PUBLIC_SITE_URL=

# AdSense
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=
NEXT_PUBLIC_ADSENSE_SLOT_PROGRESS=
NEXT_PUBLIC_ADSENSE_SLOT_PANEL_BOTTOM=
NEXT_PUBLIC_ADSENSE_ENABLED=false

# Package Registry
SIGLENS_GITHUB_TOKEN=

# Worker
WORKER_URL=
WORKER_SECRET=

# Debug
DEBUG_VERBOSE_LOGS=
```

`.env.local`에 작성. 절대 커밋하지 않는다.

---

## FMP (Financial Modeling Prep) API

### 티커 심볼 검색

```
GET https://financialmodelingprep.com/stable/search-symbol?query={query}&limit=20&apikey={FMP_API_KEY}
```

### 회사명 검색

```
GET https://financialmodelingprep.com/stable/search-name?query={query}&limit=20&apikey={FMP_API_KEY}
```

### 응답 타입

```typescript
interface FmpSearchResult {
    symbol: string;
    name: string;
    currency: string;
    exchangeFullName: string;
    exchange: string;
}
```

### 환경변수

```
FMP_API_KEY=    # 필수. 없으면 검색 결과 빈 배열 반환
```

---

## Gemini Translation API

한국어 이름 매핑이 없는 종목을 waitUntil으로 번역.

### 환경변수

```
TRANSLATE_API_KEY=              # 필수. 없으면 번역 비활성화
TRANSLATE_MODEL=gemini-2.5-flash  # 기본값
```

---

## Worker Internal API

Worker(`/worker`)는 siglens-core의 `submitAnalysis` / `submitBriefing` / `cancelAnalysisJob`이 호출하는 내부 서비스이다.

### POST `/analyze`

**Headers**

| 이름 | 필수 | 설명 |
|---|---|---|
| `X-Worker-Secret` | ✅ | `WORKER_SECRET` env와 일치해야 한다. |
| `X-AI-API-KEY` | 조건부 | `model`이 siglens 제공 모델(아래 표)이 아니면 필수. siglens 제공 모델이면 무시되고 유료 키 사용. |

**Body**

```typescript
interface AnalyzeRequest {
    jobId: string;
    prompt: string;
    model: AIModel;     // siglens-core의 TierModel — 아래 11종 중 하나
}
```

**지원 모델 및 키 정책**

| 모델 | Provider | siglens 제공 (유료 키) |
|---|---|---|
| `gemini-2.5-flash` | Gemini | ✅ |
| `gemini-2.5-flash-lite` | Gemini | ✅ |
| `claude-haiku-4-5` | Claude | ✅ |
| `gpt-5-mini` | ChatGPT | ✅ |
| `gemini-2.5-pro` | Gemini | ❌ user key |
| `gemini-3-flash-preview` | Gemini | ❌ user key |
| `gemini-3.1-pro-preview` | Gemini | ❌ user key |
| `claude-sonnet-4-6` | Claude | ❌ user key |
| `claude-opus-4-7` | Claude | ❌ user key |
| `gpt-5.4` | ChatGPT | ❌ user key |
| `gpt-5.5` | ChatGPT | ❌ user key |

`siglens 제공` 모델은 `siglens-core`의 `TIER_CONFIG.models.free`와 동일하다. 갱신 시 worker `models.ts`의 `SIGLENS_PROVIDED_MODELS`도 자동 동기화된다.

**Response**

| 코드 | Body |
|---|---|
| 200 | `{ status: 'done', jobId }` |
| 400 | `{ error: '...' }` — model 누락/미지원 또는 user key 누락 |
| 401 | `{ error: 'Unauthorized' }` |
| 500 | `{ status: 'error', jobId }` |

처리 결과는 Upstash Redis에 `job:{jobId}:status` / `job:{jobId}:result` 키로 저장되며 호출 측은 `pollAnalysisAction`으로 조회한다.

### POST `/briefing`

**Headers**: `X-Worker-Secret`만 사용. user key 없음.
**Body**: `{ jobId, prompt }`
**Provider**: `AI_PROVIDER` env에 의해 결정 (`claude` | `gemini`).
**Model**: `BRIEFING_CLAUDE_MODEL` 또는 `BRIEFING_GEMINI_MODEL` env로 결정.

### POST `/cancel`

**Headers**: `X-Worker-Secret`만 사용.
**Body**: `{ jobId }`
실행 중인 job의 `AbortController.abort()`를 호출한다.
