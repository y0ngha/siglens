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

### 2-1. Historical Price EOD Light (종가만)

```
GET /stable/historical-price-eod/light?symbol={symbol}&apikey={key}&from={from}&to={to}
```

`full`과 같은 일봉 시계열이지만 **종가와 거래량만** 돌려준다. 시장 전체 공포·탐욕 지수
(`src/entities/market-fear-greed/lib/fetchDailyCloses.ts`)처럼 OHLC가 필요 없고 심볼 수가
많은 소비자를 위한 경량 변형이다 — 6개 심볼 × 3년을 받아도 페이로드가 작다.

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| symbol | string | ✅ | 종목 심볼. 지수(`^VIX`)·ETF(`SPY`, `TLT`, `HYG`, `LQD`, `RSP`) 모두 지원 |
| apikey | string | ✅ | FMP API 키 |
| from | string | - | YYYY-MM-DD 형식 시작일 |
| to | string | - | YYYY-MM-DD 형식 종료일 |

**Response**

```typescript
interface FmpLightEodBar {
    symbol: string;
    date: string;    // "2026-08-14" (YYYY-MM-DD)
    price: number;   // 종가 — `full`의 `close`에 해당한다
    volume: number;  // 지수(^VIX 등)는 0
}

// 응답: FmpLightEodBar[] (newest-first 정렬)
```

**주의사항**
- 종가 필드명이 `close`가 아니라 **`price`**다 — `full`과 다르다.
- ⚠️ **`to`를 생략하면 진행 중인 세션의 행이 실시간가로 딸려온다.** 24시간 거래 심볼로
  실측 확인. 종가가 필요하면 `to`를 마지막 마감 세션으로 묶어야 한다
  (`lastClosedSessionDateEt`, 4시간 발행 버퍼 포함).
- 지수 심볼은 `volume: 0`이므로 거래량 기반 판정에 쓸 수 없다.
- 알 수 없는/상장폐지 심볼에 **HTTP 200 + `[]`**로 응답한다 — 에러가 아니라 빈 배열이라
  호출부가 명시적으로 걸러야 한다.

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

# AI — 챗봇 키
GEMINI_CHAT_API_KEY=
ANTHROPIC_CHAT_API_KEY=
OPENAI_CHAT_API_KEY=
GEMINI_CHAT_FREE_API_KEY=

# AI — 번역 모델(키는 DEEPSEEK_API_KEY 공유)
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

## Ticker Translation

한국어 이름 매핑이 없는 종목을 waitUntil으로 번역.

### 환경변수

```
DEEPSEEK_API_KEY=                # 필수(분석·챗과 공유). 없으면 번역 비활성화
TRANSLATE_MODEL=deepseek-v4-flash # 기본값
```

전용 번역 키는 없다 — 번역 지출은 키가 아니라 `[Usage]` 텔레메트리의 `jobId: 'translate'`로
구분된다(`koreanTranslator.ts`).

`TRANSLATE_MODEL`은 `src/entities/ticker/lib/config.ts`에서 검증된다: siglens-core의
`MODEL_SPECS`에 존재하는 **DeepSeek provider** 모델만 통과한다. 다른 provider의 모델 ID가
통과하면 DeepSeek 엔드포인트로 그 ID가 그대로 나가 401/400이 나고, `koreanTranslator.ts`가
에러를 `{}`/`null`로 삼키므로 한국어 이름이 소리 없이 전부 사라진다. 미설정·빈 문자열은 조용히
기본값으로 처리되고, 그 외 알 수 없는/타 provider 값은 기본값으로 폴백하면서 경고를
로깅한다(프로세스당 최초 1회만).

추론은 호출부에서 끄지 않는다 — `callDeepseekChat`이 `MODEL_SPECS[model].thinking`으로
결정하고, 기본 모델 `deepseek-v4-flash`는 그 값이 `false`다. `TRANSLATE_MODEL=deepseek-v4-pro`로
바꾸면 추론이 켜지며(`reasoning_effort: 'high'`) 번역 지연·비용이 크게 는다 — 결정적 변환에
이득이 없으므로 권장하지 않는다.

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
| Cloudflare Proxy Read Timeout | 125s | 침묵 구간에만 적용되며 총 소요시간엔 무관. 실측상 `text/event-stream`을 버퍼링하지 않는다 — v0.52.3에서 `duration=600&interval=25`로 2회(601.4s/601.2s, PoP LAX·SJC) 완주, drift 1초 미만 고정에 도착 간격 24.9~25.3s. |
| 라우트 마감(`STREAM_DEADLINE_MS`) | 10min | 초과 시 라우트 소유 `AbortController`가 작업을 실제로 취소한다. 취소하지 않으면 죽은 promise가 `dedupeInFlight` 맵에 남아 같은 캐시 키를 프로바이더 타임아웃(1시간)까지 봉인한다. 5min이던 것을 올렸다 — `deepseek-v4-pro`가 PLTR(promptTokens 29k)에서 248.5초를 써 여유가 52초뿐이었고, 그 뒤 요청이 300초에 잘렸다(2026-08-09). |
| AI 재시도 예산(core `RETRY_WALL_CLOCK_BUDGET_MS`) | 4min | `fn()` 실행시간까지 포함한 wall-clock 예산. 마감을 따라 올리지 **않는다** — 10분의 여유는 느린 첫 시도 하나를 완주시키는 데 쓰고, 248초 실패를 한 번 더 반복하는 데 쓰지 않는다. |

**모델별 키 정책**

siglens 제공 모델(`TIER_CONFIG.models.free`)은 서버 키로 호출하고, 그 외 모델은 사용자
키가 필요하다. 사용자 키가 없으면 `error` 이벤트로 알린다. 목록은 siglens-core의
`TIER_CONFIG`가 단일 출처다 — 이 문서에 복제하지 않는다.
