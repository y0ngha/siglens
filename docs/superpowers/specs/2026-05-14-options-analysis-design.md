# Options Analysis Design

- **Date**: 2026-05-14
- **Status**: Draft (pending implementation plan)
- **Owner**: SigLens team
- **Cross-repo impact**: `siglens` + `@y0ngha/siglens-core`

---

## 1. 목적

미국 시장 종목 페이지에 **옵션 시장 분석** 기능을 추가한다. 두 가지 표면이 있다.

- **A. 차트 페이지 보조 시그널**: 기존 `/[symbol]` 차트 페이지에 옵션 기반 보조 카드 3종을 추가하여 기술적 분석을 보강한다.
- **B. 옵션 분석 탭**: 신규 `/[symbol]/options` 페이지를 추가하여 만기별 옵션 시장 풍경을 시각화하고 AI가 해석한다. 기존 `AI 기술적 분석`과 동일한 워크플로우의 옵션 버전이다.

종합 분석(`/[symbol]/overall`)은 기존 3축(technical · fundamental · news)에 옵션을 4번째 axis로 통합하여 **5축 통합 분석**으로 확장한다.

데이터 소스는 `yahoo-finance2` (yfinance) 단독, on-demand fetch, snapshot only — 누적/cron 없이 시작한다. Tradier fallback은 YAGNI 원칙으로 후속 단계에서 고려한다.

---

## 2. 합의된 정책

| 항목 | 결정 |
|---|---|
| 데이터 소스 | yahoo-finance2 (Phase 1 단독), Tradier는 인터페이스만 추상화 |
| 데이터 누적 | 안 함 — 현재 시점 snapshot만 (운영 단순성 우선) |
| 데이터 신선도 | `'use cache' + cacheLife`. 장중 5분 / 마감 후 30분 / 주말 6시간 |
| AI 분석 호출 패턴 | 기존 분석 4종과 동일한 submit/poll 비동기 Job 큐 |
| AI 분석 트리거 | 만기 chip 선택마다 별도 호출 + 만기별 캐시 |
| "종합" 만기 처리 | 만기별 핵심 지표만 요약하여 LLM에 입력 (토큰 절감) |
| 사용량 limit 정책 | 기존 `checkAnalysisLimit` 카운터에 합산. 현재 `enableTierRestrictions: false`라 실제 제한 없음. 미래 플래그 켜지면 자동 적용 |
| 회원/비회원 | 비회원도 모든 기본 기능 사용 가능 (memory 정책 유지) |
| 모델 선택 | 기존 `SymbolModelContext`/`ModelSelector` 그대로 사용. Premium 모델 게이팅 유지 |
| 옵션 없는 종목 | 옵션 탭은 표시하지만 페이지 본문은 EmptyState. 차트 페이지 보조 카드는 자체적으로 null 반환 |
| IV Rank | yfinance가 historical IV를 안 줘서 Phase 1에서는 **ATM IV로 표시** (차트 페이지 카드명도 "ATM IV"로 변경) |

---

## 3. 아키텍처 & 분담

### 3.1 SCOPE 분담

`docs/SCOPE.md` §3 결정 트리를 그대로 적용한다.

#### siglens-core 영역 (분석 도메인 — secret sauce)

```
src/domain/options/
  ├── types.ts                     OptionsContract, OptionsChain, OptionsSnapshot,
  │                                OptionsExpirationMetrics, OptionsSymbolMetrics,
  │                                OptionsAnalysisResponse 등
  ├── calculateMaxPain.ts          만기당 Max Pain 계산
  ├── calculatePutCallRatio.ts     만기당 P/C ratio 계산
  ├── calculateImpliedMove.ts      만기당 Implied Move 계산 (ATM IV 기반)
  ├── aggregateOpenInterest.ts     strike별 콜/풋 OI 분포 집계
  ├── summarizeChainForLlm.ts      LLM 입력용 chain 요약 (토큰 절감)
  ├── sanitizeOptionsChain.ts      provider 응답 정합성 검증
  ├── expirationSlots.ts           1W/2W/1M/2M/3M/6M 슬롯 매핑
  ├── optionsPrompt.ts             buildOptionsAnalysisPrompt
  └── normalizeOptions.ts          normalizeOptionsAnalysisResponse

src/application/options/
  ├── types.ts                     SubmitOptionsAnalysisOptions, ...Result
  ├── submitOptionsAnalysis.ts     submit/poll 패턴 (기존 4종과 동일)
  └── pollOptionsAnalysis.ts

src/application/overall/
  └── (확장)                        OverallAxis에 'options' 추가
                                   resolveOverallDependencies: options axis 통합
                                   buildOverallAnalysisPrompt: 옵션 섹션 추가

src/infrastructure/options/
  └── types.ts                     OptionsDataProvider 인터페이스만 (fetch 코드 X)
```

**근거**: 옵션 계산식, AI 프롬프트, normalize, submit/poll use-case는 SCOPE Step 4 (분석 도메인 계산 / AI 프롬프트 / 분석 비즈니스 규칙)에 해당한다.

#### siglens 영역

```
src/infrastructure/options/
  ├── YahooOptionsAdapter.ts       yahoo-finance2 실제 호출 (SCOPE Step 3)
  ├── optionsCacheTags.ts          'use cache' tag 정의
  └── optionsCacheLife.ts          getOptionsCacheLifeProfile() — ET 시간대 기반

src/app/[symbol]/options/
  ├── page.tsx                     RSC, 옵션 탭 진입점
  ├── loading.tsx
  ├── opengraph-image.tsx
  └── optionsData.ts               fetch 함수들 ('use cache' 적용)

src/components/options/
  ├── OptionsPageClient.tsx        클라이언트 컨테이너
  ├── ExpirationSelector.tsx       만기 chip
  ├── OptionsAiAnalysis.tsx        AI 분석 카드 (메인)
  ├── OptionsAiAnalysisSkeleton.tsx
  ├── OptionsAiAnalysisError.tsx
  ├── OptionsMetricsRow.tsx        Max Pain · P/C · ATM IV · Implied Move 4 카드
  ├── OpenInterestChart.tsx        OI 분포 차트 (자체 SVG)
  ├── OptionsChainTable.tsx        chain 테이블 (접힘/펼침)
  ├── OptionsEmptyState.tsx        옵션 없는 종목 UI
  └── hooks/
      ├── useOptionsChain.ts       React Query
      └── useOptionsAnalysis.ts    submit + poll

src/components/symbol-page/cards/
  └── OptionsSignalCards.tsx       차트 페이지 보조 카드 3개 (ATM IV · P/C · Max Pain)

src/lib/seo.ts (확장)
  └── buildSymbolOptionsSeoContent()
```

### 3.2 SymbolTabs / CrossLinkCards 수정

**`src/components/symbol-page/utils/symbolTabsConfig.ts`** — `'options'` 탭 추가:
```typescript
export const TABS = [
    { key: 'chart', label: '차트', hrefBuilder: (s) => `/${s}` },
    { key: 'news', label: '뉴스', hrefBuilder: (s) => `/${s}/news` },
    { key: 'fundamental', label: '펀더멘털', hrefBuilder: (s) => `/${s}/fundamental` },
    { key: 'options', label: '옵션', hrefBuilder: (s) => `/${s}/options` },   // NEW
    { key: 'fear-greed', label: '공포 탐욕 지수', hrefBuilder: (s) => `/${s}/fear-greed` },
    { key: 'overall', label: '종합', hrefBuilder: (s) => `/${s}/overall` },
] as const;
```

**`src/components/symbol-page/CrossLinkCards.tsx`** — `ALL_PAGES`/`LABEL`/`DESCRIPTION`/`HREF` 4개 객체에 `options` 추가, 종합 분석 description "4축 → 5축"으로 수정, doc comment "3 sibling pages → 5 sibling pages"로 수정.

```typescript
const ALL_PAGES = [
    'chart',
    'news',
    'fundamental',
    'options',       // NEW
    'fear-greed',
    'overall',
] as const;

const LABEL: Record<PageKey, string> = {
    // ...
    options: '옵션 분석',
    overall: 'AI 종합 분석',
};

const DESCRIPTION: Record<PageKey, string> = {
    // ...
    options: '옵션 시장이 보는 가격대와 기대 변동성',
    overall: '5축 통합 AI 결론 + 시나리오',     // 4축 → 5축
};
```

차트 페이지(`src/app/[symbol]/page.tsx`)의 주석 처리된 `CrossLinkCards`는 이 작업 범위 밖 — 현 상태 유지.

### 3.3 의존 방향

```
[siglens] components/options
    ↓ import
[siglens] hooks/useOptionsAnalysis
    ↓ Server Action
[siglens] infrastructure/options/optionsActions.ts
    ↓ calls
[siglens-core] application/options/submitOptionsAnalysis
    ↓ uses interface
[siglens-core] infrastructure/options/OptionsDataProvider
    ↑ injected by
[siglens] infrastructure/options/YahooOptionsAdapter
```

---

## 4. 데이터 플로우

### 4.1 옵션 탭 페이지 (`/[symbol]/options`)

```
사용자: /AAPL/options 진입
   ↓
app/[symbol]/options/page.tsx (RSC)
   ├─ getAssetInfoCached(ticker) — 검증
   ├─ hasOptionsMarket(ticker)   — 옵션 가능 여부
   │     └─ 없으면 EmptyState 렌더, 종료
   ├─ queryClient.prefetchQuery({
   │     queryKey: QUERY_KEYS.optionsChain(ticker, defaultExpiry),
   │     queryFn: () => fetchOptionsChain(ticker, defaultExpiry),
   │   })
   └─ <HydrationBoundary>
        <OptionsPageClient symbol={ticker} expirationSlots={...} />
      </HydrationBoundary>
        ↓
   OptionsPageClient
        ├─ ExpirationSelector (chip 선택 → state)
        ├─ OptionsAiAnalysis (useOptionsAnalysis hook)
        │     └─ submitOptionsAnalysis → jobId → pollOptionsAnalysis → result
        ├─ OptionsMetricsRow (Max Pain · P/C · ATM IV · Imp. Move)
        ├─ OpenInterestChart (strike별 콜/풋 OI)
        └─ OptionsChainTable (접힘/펼침)
```

**만기 chip 변경 시**: `useOptionsChain(symbol, newExpiry)`가 새 만기 fetch (캐시 hit이면 즉시), `useOptionsAnalysis(symbol, newExpiry, modelId)`가 새 AI 분석 submit. 만기별 캐시 키 분리.

**"종합" 만기 선택 시**: `summarizeChainForLlm`이 만기별 핵심 지표(Max Pain, P/C, ATM IV, 상위 OI strike 3개)만 추려서 LLM에 입력 → 전체 chain을 다 넣으면 토큰 폭발.

### 4.2 차트 페이지 보조 카드 (`/[symbol]`)

기존 `SymbolPageClient`에 `OptionsSignalCards` 추가:

```
ChartContent
  ├─ Chart (기존)
  ├─ AI 분석 카드 (기존)
  └─ <Suspense fallback={<OptionsCardsSkeleton />}>
       <OptionsSignalCards symbol={ticker} />
     </Suspense>
       └─ useOptionsSignals(symbol)
              ↓ Server Action: getOptionsSignalsAction(symbol)
              ↓ 가장 가까운 만기 1개의 chain만 받아서
              ↓ siglens-core 함수로 ATM IV · P/C · Max Pain 도출
       ├─ AtmIvCard         (값 + InfoTooltip)
       ├─ PutCallRatioCard  (값 + InfoTooltip)
       └─ MaxPainCard       (값 + InfoTooltip)
```

옵션 없는 종목: `useOptionsSignals`가 빈 데이터 반환 → 카드 3개 자체를 렌더하지 않음 (자리 차지 0).

### 4.3 종합 분석 4축 → 5축

```
[siglens-core] resolveOverallDependencies
   ↓ 5축으로 확장
   Promise.all([
       pollAnalysis(...),              // technical
       pollFundamentalAnalysis(...),   // fundamental
       pollNewsAnalysis(...),          // news
       pollOptionsAnalysis(...),       // NEW
   ])
   ↓ 5개 모두 cached & success
   buildOverallAnalysisPrompt({
       technical, fundamental, news, options    // options 섹션 추가
   })
```

**한 축이라도 pending**: 기존 패턴 — `pending_dependencies` 응답에 axis별 jobId 포함, options jobId도 포함.

**한 축이라도 fail**: 기존 패턴 — `axis: 'options'` 정보 포함된 error로 전파.

### 4.4 캐싱 정책

| 데이터 | 캐시 위치 | TTL |
|---|---|---|
| Yahoo 옵션 chain | siglens, `'use cache' + cacheLife` | 장중 5분 · 마감 후 30분 · 주말 6시간 |
| AI 옵션 분석 결과 | siglens-core, Upstash Redis (`createCacheProvider()`) | `OPTIONS_CACHE_TTL_SECONDS = SECONDS_PER_DAY`. 위치: `siglens-core/src/infrastructure/cache/config.ts` (기존 FUNDAMENTAL/NEWS/OVERALL과 동일 위치, 동일 값) |
| `hasOptionsMarket` | siglens, `'use cache'` | 1일 |
| 차트 페이지 보조 카드 | React Query staleTime | `QUERY_STALE_TIME_MS` (기존과 동일) |

`getOptionsCacheLifeProfile()`은 현재 ET 시간 기준 `'options-market-open' | 'options-market-closed' | 'options-weekend'` 중 하나의 profile을 반환한다. 각 profile은 `next.config.ts`에 정의한다.

---

## 5. 타입 & 인터페이스 정의

### 5.1 원시 데이터 타입 (`siglens-core/src/domain/options/types.ts`)

```typescript
export interface OptionsContract {
    contractSymbol: string;
    strike: number;
    lastPrice: number | null;
    bid: number | null;
    ask: number | null;
    volume: number;
    openInterest: number;
    /** Fraction 0~1 (e.g., 0.25 = 25%). */
    impliedVolatility: number | null;
    inTheMoney: boolean;
}

export interface OptionsChain {
    /** ISO date 'YYYY-MM-DD'. */
    expirationDate: string;
    /** Days to expiration, ET-midnight reference. */
    daysToExpiration: number;
    /** Sorted ascending by strike. */
    calls: ReadonlyArray<OptionsContract>;
    puts: ReadonlyArray<OptionsContract>;
}

export interface OptionsSnapshot {
    symbol: string;
    underlyingPrice: number;
    chains: ReadonlyArray<OptionsChain>;
    /** Provider timestamp (ISO). */
    capturedAt: string;
}
```

### 5.2 계산 결과 타입

```typescript
export interface OptionsExpirationMetrics {
    expirationDate: string;
    maxPain: number;
    /** sum(put OI) / sum(call OI). */
    putCallRatio: number;
    /** ATM IV as fraction (e.g., 0.28). null if unavailable. */
    atmImpliedVolatility: number | null;
    /** Top 3 strikes by combined OI, sorted descending. */
    topOpenInterestStrikes: ReadonlyArray<{
        strike: number;
        callOpenInterest: number;
        putOpenInterest: number;
    }>;
    /** Implied move in ±% units (4.2 means ±4.2%). null if unavailable. */
    impliedMovePercent: number | null;
}

export interface OptionsSymbolMetrics {
    symbol: string;
    /** Reserved for future use; Phase 1 always returns null (no historical IV). */
    ivRank: number | null;
    perExpiration: ReadonlyArray<OptionsExpirationMetrics>;
    capturedAt: string;
}
```

### 5.3 AI 분석 응답 타입

```typescript
export interface OptionsAnalysisResponse {
    summary: string;
    perExpiration: ReadonlyArray<{
        expirationDate: string;
        commentary: string;
        tone: 'bullish' | 'bearish' | 'neutral' | 'cautious';
    }>;
    signals: ReadonlyArray<{
        kind: 'bullish' | 'bearish' | 'neutral' | 'volatility';
        message: string;
    }>;
    analyzedAt: string;
}

/** @internal Raw response before runtime normalization. */
export interface RawOptionsAnalysisResponse {
    summary?: unknown;
    perExpiration?: unknown;
    signals?: unknown;
    analyzedAt?: unknown;
}
```

### 5.4 OptionsDataProvider 인터페이스

```typescript
// siglens-core/src/infrastructure/options/types.ts
export interface OptionsDataProvider {
    fetchSnapshot(symbol: string): Promise<OptionsSnapshot | null>;
    fetchChain(symbol: string, expirationDate: string): Promise<OptionsChain | null>;
    hasOptionsMarket(symbol: string): Promise<boolean>;
}
```

### 5.5 Submit / Poll 타입

```typescript
export interface SubmitOptionsAnalysisOptions {
    symbol: string;
    companyName?: string;
    /** ISO date 'YYYY-MM-DD' or 'all' for aggregate. */
    expirationDate: string | 'all';
    modelId: string;
    snapshot: OptionsSnapshot;
    userApiKey?: string;
    tier?: Tier;
    tierConfig?: TierConfig;
    usage?: UsageContext;
    now?: Date;
}

/**
 * SubmitOptionsAnalysisApiKeyRequiredError mirrors the existing
 * Submit{Analysis,Fundamental,News,Overall}ApiKeyRequiredError shape (all are
 * type aliases for UserApiKeyRequiredError — identical runtime shape).
 */
export type SubmitOptionsAnalysisApiKeyRequiredError = UserApiKeyRequiredError;

/**
 * SubmitOptionsAnalysisError follows the existing SubmitAnalysisErrorResult
 * pattern in siglens-core (`unknownError`, `providerError`, `normalizationError`
 * variants). Reuse the existing discriminator schema verbatim — do not invent
 * new error variants for options.
 */
export type SubmitOptionsAnalysisError = SubmitAnalysisErrorResult;

export type SubmitOptionsAnalysisResult =
    | { status: 'enqueued'; jobId: string }
    | { status: 'cached'; result: OptionsAnalysisResponse }
    | { status: 'pending'; jobId: string }
    | { status: 'limit_error'; code: 'usage_limit_exceeded'; error: UsageLimitError }
    | SubmitOptionsAnalysisApiKeyRequiredError
    | { status: 'miss_no_trigger' }
    | { status: 'error'; error: SubmitOptionsAnalysisError };

export type PollOptionsAnalysisResult =
    | { status: 'success'; result: OptionsAnalysisResponse }
    | { status: 'pending' }
    | { status: 'error'; error: SubmitOptionsAnalysisError };
```

### 5.6 OverallAxis 확장

```typescript
// siglens-core/src/application/overall/types.ts
export type OverallAxis =
    | 'technical'
    | 'fundamental'
    | 'news'
    | 'options';   // NEW

export interface ResolveOverallDependenciesResult {
    // ... (기존)
    options: PollOptionsAnalysisResult;
}
```

### 5.7 React Query Keys 확장

```typescript
// siglens/src/lib/queryConfig.ts
export const QUERY_KEYS = {
    // ... (기존)
    optionsSnapshot: (symbol: string) =>
        ['optionsSnapshot', symbol] as const,
    optionsChain: (symbol: string, expiry: string) =>
        ['optionsChain', symbol, expiry] as const,
    optionsSignals: (symbol: string) =>
        ['optionsSignals', symbol] as const,
    optionsAnalysis: (symbol: string, expiry: string, modelId: string) =>
        ['optionsAnalysis', symbol, expiry, modelId] as const,
};
```

---

## 6. Normalize 함수 (Nested)

기존 4개 분석(market/news/fundamental/overall)과 동일 패턴 — raw LLM 응답을 안전하게 정규화한다.

### 6.1 정규화 함수 시그니처

```typescript
// siglens-core/src/domain/analysis/normalizeOptions.ts
export function normalizeOptionsAnalysisResponse(
    parsed: unknown,
    now?: Date
): OptionsAnalysisResponse;
```

### 6.2 정규화 케이스

| 입력 케이스 | 처리 |
|---|---|
| 모든 필드 정상 | 그대로 반환 |
| `parsed`가 null/undefined/non-object | `(asObject(parsed) ?? {})`로 빈 객체 시작 |
| `summary` 누락/non-string | `FALLBACK_SUMMARY` |
| `perExpiration` 누락/non-array | `[]` |
| `perExpiration` 항목 일부 잘못됨 | 잘못된 항목만 drop, 나머지 통과 |
| 항목의 `expirationDate` 누락/유효하지 않음 | 해당 항목 drop |
| 항목의 `commentary` 누락 | `FALLBACK_COMMENTARY` |
| 항목의 `tone` 유효하지 않은 값 | `'neutral'` |
| `signals` 누락/non-array | `[]` |
| signal 항목의 `kind` 유효하지 않음 | `'neutral'` |
| signal 항목의 `message` 누락 | 해당 signal drop |
| `analyzedAt` 누락/유효하지 않음 | `now.toISOString()` |

### 6.3 캐시 read/write 양쪽 정규화 패턴

기존 4개 분석과 동일하게 양쪽 모두 정규화한다.

**Poll 단계 (캐시 쓰기 직전)** — 1차 정규화:
```typescript
// pollOptionsAnalysis.ts
const rawResult = await workerJob.getResult();
const result = normalizeOptionsAnalysisResponse(rawResult);  // ①
await cache.set(meta.cacheKey, result, OPTIONS_CACHE_TTL_SECONDS);
return { status: 'success', result };
```

**Submit 단계 (캐시 hit 시)** — 2차 정규화 (스키마 드리프트 방어):
```typescript
// submitOptionsAnalysis.ts
const cached = await cache.get<unknown>(cacheKey);
if (cached !== null) {
    return {
        status: 'cached',
        result: normalizeOptionsAnalysisResponse(cached),    // ②
    };
}
```

이 패턴은 4개 분석에서 이미 검증된 SOP다 ([siglens-core/src/application/overall/submitOverallAnalysis.ts:230](../../../../siglens-core/src/application/overall/submitOverallAnalysis.ts) 참고).

---

## 7. UI/UX 디테일

### 7.1 레이아웃 (A: AI-first)

```
┌─────────────────────────────────────────┐
│  [1W] [2W*] [1M] [2M] [3M] [종합]     ← chip row
├─────────────────────────────────────────┤
│  ⚡ AI 옵션 분석                         │
│  ────────────────────────                 │  ← 메인 (가장 큼)
│  (텍스트 5~6줄)                          │
├──────────┬──────────┬──────────┬─────────┤
│ Max Pain │ P/C      │ ATM IV   │Imp.Move │  ← 4개 카드
│ $195 ⓘ  │ 0.72 ⓘ  │ 28% ⓘ   │±4.2% ⓘ │
├─────────────────────────────────────────┤
│  📊 Open Interest 분포 (Strike별) ⓘ     │
│  (자체 SVG bar chart, 콜=emerald,        │
│   풋=red, 현재가/MaxPain 세로선)          │
├─────────────────────────────────────────┤
│  ▸ 전체 옵션 chain 테이블 보기 (342)     │
└─────────────────────────────────────────┘
```

### 7.2 만기 chip 정렬 정책

`siglens-core/src/domain/options/expirationSlots.ts`:

```typescript
export const EXPIRATION_SLOTS = [
    { key: '1W', label: '1주', targetDays: 7 },
    { key: '2W', label: '2주', targetDays: 14 },
    { key: '1M', label: '1개월', targetDays: 30 },
    { key: '2M', label: '2개월', targetDays: 60 },
    { key: '3M', label: '3개월', targetDays: 90 },
    { key: '6M', label: '6개월', targetDays: 180 },
] as const;

export function mapExpirationsToSlots(
    expirations: ReadonlyArray<string>,
    now: Date
): ReadonlyArray<{ slot: ExpirationSlot; expirationDate: string } | null>;
```

**정책**: 각 슬롯의 `targetDays` 이상인 가장 가까운 만기 선택. 중복 매핑 방지. 매핑된 슬롯만 chip으로 표시. "종합"은 항상 표시. 초기 선택은 매핑된 첫 슬롯.

### 7.3 OI 분포 차트 — 자체 SVG 구현

- Lightweight Charts는 시계열 라이브러리라 카테고리 차트엔 부적합
- 새 차트 라이브러리(Chart.js/Recharts) 도입 비용 ↑
- SVG로 ~150줄 이내 자체 구현
- 마우스 호버 시 strike별 콜/풋 OI 값 툴팁
- 가장 두꺼운 strike 3개 약간 강조 (색 진하게)
- 세로선 2개: 현재가(amber-400), Max Pain(amber-500 점선)

### 7.4 모바일 변형

| 컴포넌트 | 데스크톱 | 모바일 |
|---|---|---|
| 만기 chip | 한 줄 | 가로 스크롤 |
| AI 분석 카드 | full width | full width |
| 핵심 지표 4개 | 1x4 grid | 2x2 grid |
| OI 차트 | 가로 800px | 가로 100%, strike 라벨 일부 생략 |
| chain 테이블 | 펼침 가능 | 펼침 시 가로 스크롤 |

차트 페이지 보조 카드: 데스크톱 1x3 / 모바일 1x3 stack (기존 카드 패턴 일관).

### 7.5 InfoTooltip 콘텐츠 (10종)

친근한 어투 ("...이에요", "...해요"), 짧은 문단 2~3개. 기존 fundamental 페이지 톤과 동일.

#### 1. ATM IV (Phase 1, 차트 페이지 + 옵션 탭 카드)
> 지금 옵션 시장이 보는 변동성이에요. 보통 20~30%가 평범한 편이고, 40% 넘으면 시장이 큰 움직임을 예상하고 있어요.
>
> 어닝 발표 같은 큰 이벤트 직전에는 보통 올라가요.

#### 2. P/C Ratio
> 풋옵션 거래량을 콜옵션 거래량으로 나눈 값이에요.
>
> 1보다 크면 풋(하락 베팅)이 더 많아 시장이 조심스럽다는 뜻이고, 1보다 작으면 콜(상승 베팅)이 더 많다는 뜻이에요.
>
> 너무 극단으로 치우치면 오히려 반대 신호로 해석하는 경우도 많아요 — 모두 두려워할 때가 바닥인 경우가 있거든요.

#### 3. Max Pain
> 옵션 만기일이 가까워질수록 주가가 끌리는 가격이에요.
>
> 옵션을 판 쪽(주로 기관)의 손실이 가장 적어지는 가격이라, 만기일 부근에는 주가가 이쪽으로 움직이는 경향이 있어요.
>
> 절대 법칙은 아니고 참고용 가격으로 보세요.

#### 4. Implied Move
> 옵션 시장이 "이 주식이 앞으로 얼마나 출렁일 것 같다"고 가격에 반영해놓은 폭이에요.
>
> 예를 들어 ±4%라면 시장은 다음 만기일까지 주가가 ±4% 정도 움직일 가능성이 높다고 보고 있는 거예요.
>
> 어닝 같은 큰 이벤트 직전에는 이 값이 평소보다 커져요.

#### 5. Open Interest
> 특정 옵션에 현재 살아있는(아직 청산 안 된) 계약 수예요.
>
> 한쪽 가격대에 OI가 두텁다는 건 그 가격에 많은 사람이 베팅했다는 뜻이에요.

#### 6. Strike (행사가)
> 옵션 계약에 정해진 매수/매도 가격이에요.
>
> 콜은 '이 가격에 살 권리', 풋은 '이 가격에 팔 권리'를 가진다는 뜻이에요.

#### 7. 만기 (Expiration)
> 옵션 계약이 만료되는 날짜예요.
>
> 가까운 만기일수록 가격 변동이 빨라요. 만기일이 지나면 옵션은 사라져요.

#### 8. Implied Volatility (chain 테이블)
> 옵션 시장이 예측하는 미래 변동성이에요.
>
> 높을수록 옵션값이 비싸지고, 불확실성이 크다는 뜻이에요.

#### 9. Volume vs Open Interest (chain 테이블 헤더 옆)
> Volume은 오늘 거래된 계약 수, OI는 현재 살아있는 모든 계약 수예요.
>
> Volume이 OI보다 크면 오늘 새 포지션이 많이 만들어졌다는 뜻이에요.

#### 10. IV Rank (Phase 2 이후만 사용)
> 지금 옵션 가격이 1년 중 어디쯤 비싼지/싼지를 0~100%로 보여줘요.
>
> 0%면 1년 중 가장 옵션이 쌌고, 100%면 가장 비쌌다는 뜻이에요.

Phase 1에서는 IV Rank 자리에 ATM IV(#1)를 표시한다.

### 7.6 옵션 chain 테이블

- 강조 행: 현재가에 가장 가까운 strike (배경색 살짝)
- Max Pain row에 작은 아이콘 표시
- 헤더: Strike · Call (Bid/Ask) · Call OI · Put (Bid/Ask) · Put OI
- 모바일 가로 스크롤

---

## 8. 에러 처리

### 8.1 실패 매트릭스

| 실패 지점 | 영향 | UI 처리 | 시스템 처리 |
|---|---|---|---|
| yfinance 네트워크 실패 | 옵션 chain 0 | "옵션 데이터 일시 불가" + 재시도 | React Query auto-retry (2회, exponential) |
| yfinance schema 변경 | 정규화 실패 | 동일 | 서버 로그 + Sentry. 라이브러리 업데이트 트리거 |
| yfinance rate limit (429) | 옵션 chain 0 | "잠시 후 다시 시도" | exponential backoff (2회). 최종 실패 시 에러 상태 표시. stale-while-revalidate는 Next.js `'use cache' + cacheLife`가 자동 처리 |
| AI 응답 JSON parse 실패 | AI 카드 | "AI 옵션 분석을 가져올 수 없었어요" + 재시도 | 워커 retry 1회. 최종 실패 시 error status |
| AI 응답 필드 누락 | AI 카드 | normalize fallback 정상 렌더 | 로그 (raw 일부 저장) |
| 옵션 없는 종목 | 페이지 전체 | EmptyState + 다른 탭 링크 | `hasOptionsMarket() === false` 정상 200 |
| Worker timeout | AI 분석 | "분석이 오래 걸리고 있어요" + 재시도 | 기존 분석 패턴 동일 |
| 종합 분석의 options axis만 실패 | overall | axis 정보 포함 error 표시 | resolver가 `axis: 'options'` 전파 |

### 8.2 ErrorBoundary 격리 정책

```
OptionsPageClient
├─ <Suspense fallback={<OptionsAiAnalysisSkeleton />}>
│    <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
│      OptionsAiAnalysis   ← AI 실패 격리
│    </ErrorBoundary>
│  </Suspense>
├─ <Suspense fallback={<OptionsMetricsSkeleton />}>
│    OptionsMetricsRow     ← 데이터 실패 시 React Query retry
│  </Suspense>
├─ <Suspense fallback={<OpenInterestChartSkeleton />}>
│    OpenInterestChart
│  </Suspense>
└─ <ErrorBoundary FallbackComponent={OptionsChainTableError}>
     OptionsChainTable
   </ErrorBoundary>
```

**원칙**: AI 실패와 데이터 fetch 실패를 분리. AI가 실패해도 핵심 지표/OI 차트는 정상 표시.

### 8.3 옵션 chain 정합성 검증

```typescript
// siglens-core/src/domain/options/sanitizeChain.ts
export function sanitizeOptionsChain(chain: OptionsChain): OptionsChain | null;
```

- 음수 OI, 음수 volume, null strike, 중복 strike 항목 drop
- 5% 이상이 invalid면 chain 자체 reject → 상위에서 "데이터 품질 문제" UI

---

## 9. 테스트 전략

### 9.1 siglens-core

**Domain 계산 함수** (vitest unit):
- `calculateMaxPain` — 알려진 chain → 알려진 Max Pain, OI 0, 단일 strike, 풋만/콜만
- `calculatePutCallRatio` — 정상, OI 0 (div by zero), 비대칭 OI
- `calculateImpliedMove` — 정상, ATM IV null, DTE 0
- `aggregateOpenInterest` — 정상, 빈 chain, strike 중복
- `sanitizeOptionsChain` — 음수, null, 중복

**Normalize** (vitest unit, 핵심 가드):
- 완전한 정상 응답 → 통과
- summary 누락 → fallback
- perExpiration이 non-array → []
- 항목 일부 잘못 → 잘못된 것만 drop
- expirationDate 없는 항목 → drop
- tone/kind 무효 값 → 'neutral'
- 캐시 hit 시 구버전 스키마 시뮬레이션 → 안전 처리

**Application use-case** (vitest with mocks):
- `submitOptionsAnalysis` 6가지 status 분기
- `pollOptionsAnalysis` 3가지 status
- 종합 분석 5축 통합 — options axis 포함된 시나리오

### 9.2 siglens

**Yahoo adapter** (vitest with fixture):
- yahoo-finance2 호출은 mock
- fixture: 정상, 빈 응답, malformed
- `hasOptionsMarket`: 가능, 불가능, 에러

**React Query hooks** (vitest + testing-library):
- `useOptionsChain` prefetched hydration, manual fetch
- `useOptionsAnalysis` submit → poll → result, 에러 분기

**Components** (vitest + testing-library):
- `ExpirationSelector` chip 렌더, 선택 변경 콜백
- `OptionsMetricsRow` 데이터 표시, InfoTooltip 포커스
- `OpenInterestChart` SVG 렌더, hover 툴팁
- `OptionsAiAnalysis` 정상 / fallback / 에러
- `OptionsChainTable` 접힘/펼침, 현재가 강조
- `OptionsSignalCards` 3개 카드, 옵션 없을 때 null

**E2E** (Playwright):
- 옵션 가능 종목 (AAPL) → chip 6개 → 클릭 시 데이터 변경
- 옵션 없는 종목 → EmptyState 렌더
- 종합 분석 → 5축 다 표시

### 9.3 Regression 가드 (CI)

- `__tests__/SCOPE.test.ts` — siglens에서 `@y0ngha/siglens-core/dist/...` deep import 금지 검증
- 기존 종합 분석 테스트가 4 → 5축 확장 후에도 통과

---

## 10. Implementation Guidelines

실제 코드 작성 단계에서 다음 스킬을 호출하여 가이드라인을 검증한다.

### 10.1 frontend-design 적용 항목

- Tailwind 색상: `secondary-700/800/900` 다크 톤 일관성
- Call = `emerald-500`, Put = `red-500`, Max Pain = `amber-500`, 현재가 = `amber-400`
- 시각적 위계: AI 분석 카드(가장 큼) > 4-metric row > OI 차트 > chain 테이블
- 만기 chip 활성 상태 transition 150ms (`transition-colors`)
- 카드 hover/focus 상태: `border-secondary-700 → border-primary-500`
- 모션: 차트 chip 전환 시 SVG bar update 부드럽게

### 10.2 web-design-guidelines 적용 항목

- 모든 InfoTooltip: 키보드 포커스 가능, Esc로 닫기, `aria-describedby` 연결
- 만기 chip: `role="tablist"`, 각 chip `role="tab"` + `aria-selected`
- OI 차트(SVG): `role="img"` + `<title>` + `<desc>`, 차트 아래 시각 보조용 data table fallback
- 색상만으로 의미 전달 X — Call/Put은 색 + 라벨 텍스트 병행
- chain 테이블: `<th scope="col">`, `<caption>`, 정렬 가능 시 `aria-sort`
- `focus-visible:ring-primary-500` 일관 적용
- `prefers-reduced-motion` 시 transition 비활성
- 터치 타겟 ≥ 44px (chip, 카드, 버튼)

### 10.3 seo-audit 적용 항목

- `generateMetadata`: title, description, keywords, canonical
- `buildSymbolOptionsSeoContent` 신설 (`src/lib/seo.ts`)
- JSON-LD: WebPage + breadcrumb + FAQ
- FAQ 질문:
  - "옵션 시장 분석에서 무엇을 볼 수 있나요?"
  - "Max Pain, Open Interest는 어떻게 해석하나요?"
  - "내 종목에 옵션이 없으면 어떻게 되나요?"
- `sr-only` 영역: `<h2>` "옵션 시장 풍경" + 본문 (검색엔진용)
- robots: 옵션 없는 종목 페이지는 `noindex` (옵션 가능 종목만 색인)
- sitemap: 동적 sitemap에 옵션 페이지 추가 (옵션 가능 종목만)
- 모바일 친화성: viewport, 핀치 줌, 터치 타겟 ≥ 44px
- 페이지 속도:
  - RSC streaming + Suspense (`loading.tsx`)
  - `'use cache' + cacheLife`로 LCP 개선
  - Lightweight Charts 없이 SVG 자체 구현 → 번들 작음
- internal linking: CrossLinkCards 양방향 연결
- locale `ko_KR` 일관성
- OG image (`opengraph-image.tsx`) 자체 생성

### 10.4 코드 작성 후 호출할 스킬 순서

1. `frontend-design` — 컴포넌트 새로 작성할 때
2. `web-design-guidelines` — 컴포넌트 완성 후 review
3. `seo-audit` — 옵션 페이지 배포 직전 전체 사이트 audit

---

## 11. Out of Scope

다음 항목은 본 spec의 범위 밖이다. 별도 후속 spec/issue로 다룬다.

- **데이터 시계열 누적**: 매일 옵션 chain snapshot DB 저장, "OI 변화 추이" 분석. 운영 부담 vs 가치 검증 후 결정.
- **Tradier fallback 구현**: 인터페이스만 추상화. 실제 어댑터는 yfinance 안정성 검증 후.
- **IV Rank 활성화**: 시계열 누적 결정 후 가능.
- **옵션 chain 테이블 정렬/필터**: 기본 strike 순 정렬만. 정렬 변경 기능은 후속.
- **그릭스 (Delta/Gamma/Theta) 표시**: 옵션 거래자용 기능. SigLens 포지셔닝과 거리.
- **Unusual Options Activity 감지**: 시계열 누적 필요.
- **차트 페이지의 CrossLinkCards 활성화**: 현재 주석 처리됨. 별도 결정 영역.
- **한국 시장 옵션**: 현재 데이터 소스가 미국 시장만 지원.

---

## 12. 변경 이력

| 일자 | 변경 |
|---|---|
| 2026-05-14 | 최초 작성 |
