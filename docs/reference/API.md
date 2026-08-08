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
GET /stable/historical-chart/5min?symbol=AAPL&apikey={key}&from=2024-01-01&to=2024-01-15
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

### 4. Financial Statements (재무제표 6종)

`/[symbol]/financials` 탭이 사용. 모두 동일한 query parameter 형태를 가지며,
`FmpFinancialStatementsClient`(`src/shared/api/fmp/financialStatementsClient.ts`)가
호출한다.

| # | Endpoint | 메서드 | 설명 |
|---|---|---|---|
| 1 | `/stable/income-statement` | GET | 손익계산서 (매출·이익·EPS) |
| 2 | `/stable/balance-sheet-statement` | GET | 재무상태표 (자산·부채·자본) |
| 3 | `/stable/cash-flow-statement` | GET | 현금흐름표 (영업·투자·재무 CF) |
| 4 | `/stable/income-statement-growth` | GET | 손익 성장률 (YoY) |
| 5 | `/stable/financial-growth` | GET | 재무 성장률 (매출·이익·FCF YoY) |
| 6 | `/stable/cash-flow-statement-growth` | GET | 현금흐름 성장률 (YoY) |

**Query Parameters (6종 공통)**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| symbol | string | ✅ | 종목 심볼 |
| period | string | ✅ | `annual` 또는 `quarter` |
| limit | number | ✅ | 반환 기간 수 (annual 5, quarter 8). 캐시 오염 방지를 위해 항상 MAX로 fetch 후 slice |
| apikey | string | ✅ | FMP API 키 |

**Request 예시**

```
GET /stable/income-statement?symbol=AAPL&period=annual&limit=5&apikey={key}
```

**주의사항**
- 6종을 `Promise.all`로 병합해 단일 `FinancialsSnapshot`으로 정규화 (core의 `normalizeFinancialsSnapshot`)
- 마진·성장률 등 파생값은 client에서 set하지 않고 core 정규화가 계산
- 2계층 캐시(Next Data Cache `fmpGet` revalidate + Redis `getOrSetCache`)가 단일 TTL 공유

---

## 환경변수 전체 목록

```bash
# Market Data
FMP_API_KEY=

# AI — 분석용 서버 키(core가 프로바이더를 직접 호출)
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=

# AI — 챗봇/번역 키
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
TRANSLATE_API_KEY=                    # 필수. 없으면 번역 비활성화
TRANSLATE_MODEL=gemini-2.5-flash-lite # 기본값 — 프로덕션 실측값(사고 비활성화 시 thoughts=0)과 일치
```

`TRANSLATE_MODEL`은 `src/entities/ticker/lib/config.ts`에서 검증된다: siglens-core의
`MODEL_SPECS`에 존재하는 Gemini provider 모델이면서, `thinkingBudget: 0`(koreanTranslator.ts가
하드코딩하는 값)을 라이브로 지원 확인된 모델(`GEMINI_MODELS_SUPPORTING_DISABLED_THINKING`)만
통과한다 — Gemini가 아닌 모델(Claude 등), MODEL_SPECS에 없는 값, 그리고 사고 비활성화를
지원하지 않는 것으로 확인된 Gemini 모델(예: `gemini-3.1-pro-preview`, `gemini-3.5-flash-lite`,
`gemini-3.6-flash` — 0을 400으로 거부)은 모두 거부된다. 미설정·빈 문자열은 조용히 기본값으로
처리되고, 그 외 알 수 없는/미지원 값은 기본값으로 폴백하면서 경고를 로깅한다(프로세스당 최초
1회만).

---
## 분석 SSE 라우트 — `POST /api/analysis/stream`

worker(`/analyze`, `/briefing`, `/cancel`)와 Redis job 신호 체계는 제거됐다. 지금은 이
라우트 하나가 요청을 받아 **그 요청 안에서** core의 `run*` 함수를 호출하고, LLM 응답까지
기다렸다가 결과를 SSE로 돌려준다. 프로바이더 호출은 core가 서버 키(`ANTHROPIC_API_KEY` /
`GEMINI_API_KEY` / `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`)로 직접 수행한다.

**Body**

```typescript
interface AnalysisStreamRequest {
    type: AnalysisType; // 'technical' | 'overall' | 'news' | 'options' | ... (라우트의 DISPATCH 테이블)
    params: Record<string, unknown>; // type별 파라미터
}
```

`force`는 받지 않는다 — 인증 없는 공개 라우트라 클라이언트가 캐시 우회를 지시할 수 없어야
한다. 서버가 재분석 쿨다운(`tryAcquireReanalyzeCooldown`)에서 직접 파생한다.

**이벤트**

| event | data | 의미 |
|---|---|---|
| `open` | `{}` | 스트림 수립. 즉시 전송해 프록시가 첫 바이트를 보게 한다. |
| `heartbeat` | `{}` | 25초 주기. idle 타임아웃 방지용이며 클라이언트는 조용히 버린다. |
| `done` | `{ result }` | 분석 완료. `result`는 해당 `run*`의 반환값. |
| `error` | `{ message }` | 실패. 게이트 차단·한도 초과·LLM 실패·마감 초과를 모두 포함한다. |

**타임아웃 계층**

| 구간 | 값 | 근거 |
|---|---|---|
| heartbeat 간격 | 25s | 아래 두 상한 모두보다 충분히 짧다. |
| ALB idle timeout | 60s | **실측된 진짜 벽**. 침묵이 61.1초면 연결이 끊긴다(v0.50.1 `/api/sse-probe` 프로덕션 측정). 최대 4000s까지 조정 가능. |
| Cloudflare Proxy Read Timeout | 125s | 침묵 구간에만 적용되며 총 소요시간엔 무관. 실측상 `text/event-stream`을 버퍼링하지 않는다(286초 완주 확인). |
| 라우트 마감(`STREAM_DEADLINE_MS`) | 5min | 초과 시 라우트 소유 `AbortController`가 작업을 실제로 취소한다. 취소하지 않으면 죽은 promise가 `dedupeInFlight` 맵에 남아 같은 캐시 키를 프로바이더 타임아웃(1시간)까지 봉인한다. |

**모델별 키 정책**

siglens 제공 모델(`TIER_CONFIG.models.free`)은 서버 키로 호출하고, 그 외 모델은 사용자
키가 필요하다. 사용자 키가 없으면 `error` 이벤트로 알린다. 목록은 siglens-core의
`TIER_CONFIG`가 단일 출처다 — 이 문서에 복제하지 않는다.
