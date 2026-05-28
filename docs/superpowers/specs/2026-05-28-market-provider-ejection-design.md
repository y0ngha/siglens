# Market Data Provider 이전 — core → siglens 설계

- 작성일: 2026-05-28
- 상태: 설계 승인 완료 (구현 계획 작성 대기)
- 관련: `docs/SCOPE.md` §3 Step 3 · §4 안티패턴 · §5

## 1. 배경 / 문제

`@y0ngha/siglens-core`가 외부 시장 데이터 API를 **직접 fetch**하는 코드를 소유하고 있다.
SCOPE §3 Step 3 / §4가 명시적으로 금지하는 패턴이다 — core는 `MarketDataProvider`
포트 인터페이스만 소유하고, 실제 fetch 구현은 consumer(siglens)가 주입해야 한다.

위반 지점:

- `infrastructure/market/fmp.ts` `FmpProvider` — `fetch('https://financialmodelingprep.com/...')`
- `infrastructure/market/alpaca.ts` `AlpacaProvider` — `fetch('https://data.alpaca.markets/...')`
- `infrastructure/market/factory.ts` `createMarketDataProvider()` — 위 둘을 wiring
- core use-case(`fetchBarsWithIndicators`, `getMarketSummary`, `getSectorSignals`,
  `submitAnalysis`, `submitOverallAnalysis`)가 **내부에서** factory를 호출

부차 정황: siglens는 이미 `shared/api/fmp/`에 FMP fundamental fetch(`fmpGet` httpClient)를
보유. 즉 FMP fetch가 두 레포로 쪼개져 있다(펀더멘털=siglens, bars/quote=core). 이전으로
모든 FMP fetch를 siglens로 통합한다.

## 2. 확정 결정

| # | 결정 | 근거 |
|---|---|---|
| 주입 방식 | **명시적 주입(DI)** | 숨은 전역 없음, 테스트 용이, SCOPE "consumer가 주입" 정신 |
| FMP HTTP | **기존 `fmpGet` 재사용** | FMP fetch 단일화 + bars/quote에 rate-limit retry 획득 |
| Alpaca | **제거** | `MARKET_DATA_PROVIDER` 기본값 fmp, prod 미사용 |
| `readFmpConfig` | **core 잔존** | SCOPE §3 Step 3 env reader 예외, siglens httpClient가 이미 import 중 |
| publish | **사용자가 직접 수행** | core npm publish는 사용자 담당. Claude는 publish하지 않는다 |

## 3. 소비자 지형

- market provider를 거치는 core use-case:
  - 직접 생성: `fetchBarsWithIndicators`, `getMarketSummary`, `getSectorSignals`
  - 전이 호출: `submitAnalysis`(→fetchBars), `submitOverallAnalysis`(→fetchBars),
    `getMarketSummaryWithBriefing`(→getMarketSummary)
  - **무관**: `submitBriefing` — `MarketSummaryData`를 인자로 받아 자체 fetch 안 함
- 소비자는 **siglens 앱 단독**. `siglens-worker`(core 0.9.4)는 AI 완성만 담당하고
  market 심볼을 import하지 않음 → **무영향**.
- 앱 호출 지점 5곳: `getBarsAction`, `getMarketSummaryAction`, `getSectorSignalsAction`,
  `submitAnalysisAction`, `submitOverallAnalysisAction`.

## 4. core 변경 (`../siglens-core` 레포)

### 4.1 삭제

- `src/infrastructure/market/fmp.ts`
- `src/infrastructure/market/alpaca.ts`
- `src/infrastructure/market/factory.ts`
- `src/index.ts`: `export { createMarketDataProvider } from './infrastructure/market/factory';` (line 292) 제거
- (`MarketDataProviderType`·`AlpacaConfig`는 `index.ts`/`index.client.ts`에서 export되지
  않음 → 공개 API 추가 작업 없음)

### 4.2 config / types 분리 (in-place, 경로 유지)

- `src/infrastructure/market/config.ts`: `readMarketProviderType`·`readAlpacaConfig` **삭제**.
  `readWorkerConfig`/`tryReadWorkerConfig`는 **잔존** — 8개 use-case(submitAnalysis,
  submitOptionsAnalysis, submitNewsAnalysis, submitFundamentalAnalysis, submitBriefing,
  submitNewsCardAnalysis, cancelAnalysisJob, submitOverallAnalysis)가
  `@/infrastructure/market/config`에서 import하므로 **파일 경로·심볼 무변경**.
- `src/infrastructure/market/types.ts`: `AlpacaConfig`·`MarketDataProviderType` **삭제**.
  `WorkerConfig`·`AcquireReanalyzeCooldownResult`는 잔존.

### 4.3 잔존 (변경 없음)

- `src/domain/ports/marketDataProvider.ts` — `MarketDataProvider` + `GetBarsOptions` 포트
- `src/domain/types` — `Bar`, `MarketQuote`, `Timeframe`
- `src/infrastructure/market/constants.ts` — `FETCH_DEFAULT_TIME_OUT`(=10s).
  `submitBriefing`의 worker enqueue fetch가 사용하므로 잔존.
- `src/infrastructure/market/reanalyzeCooldown.ts`
- `src/infrastructure/fmp/config.ts` — `readFmpConfig`/`tryReadFmpConfig`(env reader, siglens가 import)

### 4.4 use-case 주입 시그니처

**leaf 3개 — `provider`를 첫 위치 인자로:**

```ts
fetchBarsWithIndicators(
  provider: MarketDataProvider,
  symbol: string,
  timeframe: Timeframe,
  fmpSymbol?: string,
  now?: Date,
): Promise<BarsData>

getMarketSummary(provider: MarketDataProvider): Promise<MarketSummaryData>

getSectorSignals(
  provider: MarketDataProvider,
  timeframe?: DashboardTimeframe,
  now?: Date,
): Promise<SectorSignalsResult>
```

- `getMarketSummaryWithBriefing(provider, ...)` → 내부 `getMarketSummary(provider)`로 thread.
- `getSectorSignals` 내부 `fetchBarsAndQuotes(provider, ...)`는 **이미 provider 인자를 받음**
  → 함수 본문의 `const provider = createMarketDataProvider();`만 파라미터 참조로 교체.
- 각 use-case 본문의 `createMarketDataProvider()` 호출 및 그 import 제거.

**submit* 2개 — 기존 options 객체에 필드 추가 (오버로드/객체 시그니처 보존):**

```ts
interface SubmitAnalysisOptions extends BackgroundTaskOptions {
  marketDataProvider: MarketDataProvider; // 신규 (필수)
  // ...기존 필드
}

interface SubmitOverallAnalysisOptions {
  marketDataProvider: MarketDataProvider; // 신규 (필수)
  // ...기존 필드
}
```

- 내부 `fetchBarsWithIndicators(...)` 호출을
  `fetchBarsWithIndicators(options.marketDataProvider, symbol, tf, fmpSymbol)`로 교체.
- `submitAnalysis`는 오버로드 함수라 위치 인자를 추가하면 시그니처가 깨지므로 options 필드로
  주입. 호출자(siglens 앱)가 항상 주입하므로 **필수 필드**(breaking change).

### 4.5 테스트

- **삭제**: `src/__tests__/infrastructure/market/{fmp,alpaca,factory}.test.ts`
- **수정**: `src/__tests__/infrastructure/market/config.test.ts` — alpaca/provider-type 케이스
  제거, worker config 케이스 유지
- **수정**: `barsApi.test`, `getMarketSummary.test`, `sectorSignals.test`, submitAnalysis /
  submitOverallAnalysis 테스트 — `vi.mock('@/infrastructure/market/factory')` 제거하고
  fake `MarketDataProvider`(`{ getBars: vi.fn(), getQuote: vi.fn() }`)를 인자/options로 직접 주입

## 5. siglens 변경

### 5.1 신규

- `src/shared/api/fmp/FmpMarketProvider.ts` — `MarketDataProvider` 구현. core `fmp.ts`에서 이식:
  - ET/DST 타임스탬프 변환 헬퍼 전부 이식: `getNthSundayOfMonth`, `getEtOffsetHours`,
    `fmpIntradayDateToUtcSeconds`, `toFmpBar`, `toFmpDailyBar`, 인트라데이 TF 매핑
    (`FMP_INTRADAY_TIMEFRAME_MAP`), daily + today-quote 병합 로직.
  - fetch는 `fmpGet`으로 교체:
    - `getBars` intraday → `fmpGet<FmpBar[]>('historical-chart/<fmpTf>', { symbol, from?, to? })`
    - `getBars` daily → `fmpGet<FmpDailyBar[]>('historical-price-eod/full', { symbol, from?, to? })`
    - `getQuote` / today-quote → `fmpGet<FmpQuote[]>('quote', { symbol })`
  - **`getQuote`·`fetchTodayQuoteBar`는 try/catch로 `fmpGet`의 throw를 흡수해 `null` 반환**
    (기존 graceful degradation 보존).
- `src/shared/api/market/getMarketDataProvider.ts` — `new FmpMarketProvider()`를 반환하는
  단일 생성점(모듈 레벨 memoized 싱글톤). 5개 action이 공유(DRY). provider가 FMP 하나뿐이라
  dispatch map 불필요.
- 테스트: `src/shared/api/fmp/__tests__/FmpMarketProvider.test.ts` — `fmpGet` mock,
  bars/quote 매핑 · DST 경계 · null 흡수 검증.

### 5.2 server action 주입 (5곳)

- `entities/bars/actions/getBarsAction.ts`:
  `fetchBarsWithIndicators(getMarketDataProvider(), symbol, timeframe, fmpSymbol)`.
  **추가로**: 기존 `withRetry(..., BARS_FMP_RETRY)` 래퍼 **제거** — `fmpGet`이 동일 정책
  (`FMP_TRANSIENT_RETRY`)으로 provider 레이어에서 retry하므로 액션 레이어 retry는 중복(이중
  retry 회귀 방지). FMP user-message 매핑(`getFmpUserFacingMessage`/`logFmpPaymentRequiredError`)은
  유지. `lib/barsRetry.ts`(`isCoreFmpTransientError`/`getCoreFmpRetryDelayMs`/`BARS_FMP_RETRY`)와
  `__tests__/barsRetry.test.ts` **삭제**(getBarsAction 외 사용처 없음). 이 shim들은 애초에
  core `FmpProvider`가 retry 없이 generic Error를 던졌기 때문에 둔 것이라, FMP가 siglens로
  오면 존재 이유가 사라진다.
- `entities/market-summary/actions/getMarketSummaryAction.ts`:
  `getMarketSummary(getMarketDataProvider())`,
  `getMarketSummaryWithBriefing(getMarketDataProvider())`
- `entities/sector-signal/actions/getSectorSignalsAction.ts`:
  `getSectorSignals(getMarketDataProvider(), timeframe)`
- `entities/analysis/actions/submitAnalysisAction.ts`: 두 호출 분기 모두 options에
  `marketDataProvider: getMarketDataProvider()` 추가
- `entities/analysis/actions/submitOverallAnalysisAction.ts`: options에
  `marketDataProvider: getMarketDataProvider()` 추가
- `package.json`: `@y0ngha/siglens-core` 버전 bump

### 5.3 FSD 배치

provider는 `shared/api`에 위치 — 모든 레이어 import 가능, entity action이 호출. 레이어
의존 방향 위반 없음.

## 6. PR 순서 & 안전성

1. **core PR** (`../siglens-core`): 4절 전체 + 테스트 통과 → **사용자가 npm publish**.
2. **siglens PR**: core dep bump + 5절 전체 + 테스트.

- worker 무영향(별도 core 버전 고정, market 심볼 미사용).
- core 변경은 별도 레포 작업(CLAUDE.md cross-repo 가드). siglens 작업트리에서 우회 구현 금지.

## 7. 동작 델타 (의도된 변경)

- **bars 경로**: retry가 **추가되는 게 아니라 이동**한다. 기존엔 `getBarsAction`이
  `withRetry(BARS_FMP_RETRY)`로 감쌌고(core FmpProvider는 retry 없음), 이전 후엔 `fmpGet`의
  `FMP_TRANSIENT_RETRY`가 담당. 두 정책은 사실상 동일(maxRetries 3, baseDelay 500ms, budget
  60s, 429→10/15/20s)이라 동작 보존. 단 retry 위치가 fetch 단위로 더 세분화(인디케이터 재계산
  없이 fetch만 재시도) + `Retry-After` 헤더 우선 적용으로 개선.
- **quote / market-summary / sector-signals / submit\* 경로**: 기존에 retry가 전혀 없던 경로라
  **retry 3회가 신규 추가**된다(`fmpGet` 재사용 결과). rate-limit 내성 향상.
- bars/quote 실패 에러 타입: generic `Error` → 구조화된 `FmpHttpError`. 다운스트림
  `getFmpErrorStatus`/`fmpUserMessage`가 이미 양쪽을 파싱하므로 호환.
- 타임아웃: 10s 동일(core `FETCH_DEFAULT_TIME_OUT`=10s, siglens `FMP_FETCH_TIMEOUT_MS`=10s).
- bars/quote 매핑 · DST 변환 · daily(EOD + today-quote) 병합 동작은 **100% 보존**.

## 8. 리스크 / 엣지

- **오버로드 안전**: `submitAnalysis`는 provider를 options 필드로 주입해 위치 인자 시그니처 불변.
- **config 경로 유지**: `market/config.ts` 경로를 바꾸지 않아 worker config import 8곳 무변경.
  (장기적으로 `infrastructure/worker/`로 relocate 가능하나 본 PR 범위 외.)
- **getQuote null 보존**: `fmpGet`은 !ok에서 throw하므로 반드시 try/catch로 감싸 기존
  null-on-failure 계약을 유지.
- **daily 병합**: `Promise.all([eod fetch, fetchTodayQuoteBar])`에서 eod 실패는 throw(retry 후
  전파), today-quote 실패는 null 흡수 — 기존 분기 동작 유지.
- **이중 retry 회귀 방지**: getBarsAction의 `BARS_FMP_RETRY` 래퍼를 제거하지 않으면 액션
  retry(3) × provider retry(3)로 최대 9회 재시도되어 latency·API 호출이 증폭된다. 반드시
  §5.2대로 액션 래퍼를 제거해 retry 단일화. (brainstorming 단계 이후 코드 정독 중 발견된 spec
  보정 사항.)
