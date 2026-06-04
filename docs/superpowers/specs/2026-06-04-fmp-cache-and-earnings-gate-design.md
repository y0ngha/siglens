# FMP 캐시 개선 — earnings gate + 분석/차트 provider 캐시 — 설계

- 날짜: 2026-06-04
- 상태: **설계 확정, 구현 대기**
- 브랜치: `fix/fmp-cache-and-earnings-gate` (worktree: `siglens-earnings-stale`)
- 범위: **siglens 단독** (`@y0ngha/siglens-core` 무변경)
- 관련: market-isr 설계(`.claude/worktrees/market-isr/docs/superpowers/specs/2026-06-04-market-isr-design.md`) — **영역 분리**(아래 §5)
- 참조 규약: `docs/architecture/SCOPE.md`(§Step 3 — 시장 데이터 fetch/캐싱은 siglens), `src/shared/CLAUDE.md`(shared/cache·api)

## 배경 / 문제

FMP 대시보드에서 5개 경로(`/stable/profile`, `/stable/grades`, `/stable/earnings`,
`/stable/historical-price-eod/full`, `/stable/quote`)의 사용량이 높게 관측되어,
각 경로의 Redis 캐시 동작을 코드로 전수 검증했다. 결과:

- **`profile` / `grades`**: `CachedFundamentalProvider`(Redis 1h) + Next Data Cache(1h)
  + ISR(1h)로 완전히 캐시됨. 우회 경로 없음. → **수정 불필요.**
- **`earnings`**: Redis/Next 무캐시(`fmpGetRaw` no-store), DB 24h staleness gate에만 의존.
  gate 로직에 우회 결함 존재(아래 §1).
- **`historical-price-eod/full`(bars), `quote`**: 차트 경로는 Redis 캐시(`getCachedBarsWithIndicators`)
  + ISR로 잘 캐시되나, **분석 경로**(`submitAnalysis`/`submitOverallAnalysis`)는 결과 cache-miss 시
  core `fetchBarsWithIndicators`를 직접 호출 → `FmpMarketProvider.getBars/getQuote`가 `no-store`라
  차트 Redis 캐시(`bars:SYM:TF`)를 재사용하지 못하고 FMP를 직격한다. 추가로 1Day bars 호출마다
  `fetchTodayQuoteBar`가 `quote`를 동반 호출하고, 분석 내부에서 fear&greed용 1Day bars를
  별도로 또 호출한다(아래 §2).

> market summary·sector signals 경로의 quote/bars 캐싱은 **market-isr 작업이 전담**하므로
> 본 작업에서 손대지 않는다(§5).

## 목표

1. **earnings gate 우회 제거**: "표시할 earnings 없는 종목"이 24h gate를 무력화하고
   매 요청 FMP refetch하는 영구 cache-miss 루프를 차단.
2. **분석/차트 경로의 bars/quote FMP 직격 제거**: provider 레벨 Redis 캐시 데코레이터를
   분석/차트 경로에만 주입해, 차트·분석·today-quote·fear&greed 1Day가 동일 캐시를 공유.
3. **market-isr과 충돌 0**: 공유 파일을 건드리지 않는다(§5).

## 제약 / 검증 기준

- `docs/architecture/SCOPE.md` §Step 3: 시장 데이터 fetch와 그 캐싱은 siglens 영역.
  "분석 *결과* 캐시 TTL"은 core 영역이므로 건드리지 않는다.
- 기존 패턴 미러링: `CachedFundamentalProvider` 데코레이터 + `getOrSetCache`(envelope + shouldCache 가드).
- E2E: `FakeMarketProvider`는 데코레이터로 감싸지 않는다(Redis 미설정이라 무의미).
- 테스트 커버리지: 변경면 90%+, Happy Path + Worst Case 모두.
- 작업은 worktree로 분리. node_modules는 `cp -al` 하드링크(symlink 금지 — 메모리 규약).

---

## 설계 — §1. earnings DB gate 우회 수정 (fundamental 도메인)

### 문제 상세

`src/app/[symbol]/news/newsData.ts`의 `shouldRefreshEarningsReports`:

```ts
return (
    comparisonItems.length === 0 ||                              // A — 우회 원인
    fetchedAt === null ||                                        // B
    Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS  // C (24h)
);
```

조건 A(`comparisonItems.length === 0`)는 `fetchedAt`이 방금 갱신됐어도 true가 될 수 있다.
표시 가능한 earnings(과거 actual값 또는 미래 estimate값)가 없는 종목은 refetch 후에도
`getComparisonItems`가 또 `[]`를 반환 → 다음 방문에도 또 fetch → **영구 cache-miss 루프**.
news 페이지 경로에만 존재하며, 분석 경로(`nextEarningsReport.ts`)는 `fetchedAt` 단독 기준이라
이 결함이 없다.

### 변경

- **신규** `src/entities/earnings-report/lib/isEarningsReportStale.ts`:
  ```ts
  import { MS_PER_DAY } from '@/shared/config/time';

  /** earnings DB row가 stale(재fetch 필요)인지 — fetchedAt 단독 기준.
   *  news 페이지와 분석 경로(nextEarningsReport)가 공유해 staleness 판정을 단일화한다. */
  export const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

  export function isEarningsReportStale(fetchedAt: Date | null): boolean {
      return (
          fetchedAt === null ||
          Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS
      );
  }
  ```
- `newsData.ts`: `shouldRefreshEarningsReports` 함수 + 로컬 `EARNINGS_REPORT_STALE_MS`/`MS_PER_DAY`
  import 제거 → `isEarningsReportStale(fetchedAt)` 사용. `comparisonItems`는 fetch 후 재조회·반환용으로 유지.
- `src/entities/earnings-report/lib/nextEarningsReport.ts`: 중복 정의된 `EARNINGS_REPORT_STALE_MS`
  + inline `isStale` → `isEarningsReportStale` 사용. 불필요해진 `MS_PER_DAY` import 제거.
- `src/entities/earnings-report/index.ts`: `isEarningsReportStale`, `EARNINGS_REPORT_STALE_MS` export 추가.

### 동작 변화

- 첫 방문(빈 DB) → `fetchedAt === null` → fetch (정상 유지).
- "행은 있으나 표시 데이터 없는 종목" → `fetchedAt` fresh면 24h 동안 refetch 안 함 (결함 제거).
- 24h 경과 → fetch (정상 유지).

> 쿼리 정합성은 검증 완료: `getLatestFetchedAt`(symbol PK 인덱스 + `fetched_at DESC LIMIT 1`),
> `fetched_at`이 `timestamptz`(타임존 오차 없음), `.defaultNow()` + upsert `excluded.fetched_at`으로
> 갱신마다 시계 리셋. gate 로직만 수정하면 된다.

---

## 설계 — §2. 분석/차트 전용 provider 캐시

### 핵심 해법

`MarketDataProvider`를 provider 레벨에서 캐싱하는 데코레이터를 도입하되,
**market-isr 충돌 회피를 위해 전역 싱글톤(`getMarketDataProvider`)은 그대로 두고**
분석/차트 전용 팩토리를 신설해 그 경로에만 주입한다. 모든 분석/차트 경로가
`provider.getBars`/`getQuote`를 거치므로, 여기서 캐싱하면 차트·분석·today-quote·fear&greed 1Day가
동일 캐시를 공유한다(분석 cache-miss 시 차트가 워밍한 bars 재사용, 1Day 중복은 같은 키로 흡수).

### §2-1. `shared/api/market/CachedMarketDataProvider.ts` (신규)

`CachedFundamentalProvider` 패턴 미러링. `getOrSetCache`(Upstash Redis, envelope + shouldCache 가드) 사용.

```ts
import 'server-only';
import {
    type Bar, type GetBarsOptions, type MarketDataProvider,
    type MarketQuote, type Timeframe, computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';

const QUOTE_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

// 결과-영향 필드를 모두 키에 포함(symbol/timeframe/from/before/limit). FmpMarketProvider는
// 현재 limit을 URL에 안 쓰지만, 캐시 호출부가 limit을 timeframe별 상수로 고정(종속)하므로
// 키에 넣어도 분할이 없고, 옵션 확장 시 충돌을 방지한다(PR #564 Gemini 리뷰 반영).
function buildBarsRawKey(o: GetBarsOptions): string {
    return `bars:raw:${o.symbol.toUpperCase()}:${o.timeframe}:${o.from ?? ''}:${o.before ?? ''}:${o.limit ?? ''}`;
}

export class CachedMarketDataProvider implements MarketDataProvider {
    constructor(private readonly inner: MarketDataProvider) {}

    getBars = (options: GetBarsOptions): Promise<Bar[]> =>
        getOrSetCache(
            buildBarsRawKey(options),
            computeBarsEffectiveTtl(options.timeframe, new Date()),
            () => this.inner.getBars(options),
            bars => bars.length > 0,   // 빈 봉(transient) 미캐싱 — 기존 가드 패턴
        );

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            computeBarsEffectiveTtl(QUOTE_TTL_TIMEFRAME, new Date()), // 장중 60s / 장외 min(24h,개장)
            () => this.inner.getQuote(symbol),
            quote => quote !== null,   // null(미가용) 미캐싱
        );
}
```

- 에러 처리: `inner.getBars`가 throw하면 `getOrSetCache`의 `set` 전에 전파되어 장애가 캐싱되지 않는다
  (CachedFundamentalProvider와 동일 계약). 데코레이터는 별도 catch 없이 그대로 전파.
- `getQuote`는 `FmpMarketProvider`가 이미 내부 try/catch로 null을 반환하므로 추가 로깅 불필요.

### §2-2. `shared/api/market/getCachedMarketDataProvider.ts` (신규)

```ts
import 'server-only';
import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { getMarketDataProvider } from './getMarketDataProvider';
import { CachedMarketDataProvider } from './CachedMarketDataProvider';
import { isE2E } from '@/shared/api/e2eEnv';

let cached: MarketDataProvider | null = null;

/** 분석/차트 경로 전용 Redis 캐시 provider(싱글톤).
 *  E2E면 Fake(getMarketDataProvider) 그대로 — Redis 미설정이라 데코레이터 무의미.
 *  market summary/sector 경로는 getMarketDataProvider(raw)를 계속 쓴다(market-isr 전담). */
export function getCachedMarketDataProvider(): MarketDataProvider {
    if (cached !== null) return cached;
    cached = isE2E()
        ? getMarketDataProvider()
        : new CachedMarketDataProvider(getMarketDataProvider());
    return cached;
}
```

- `getMarketDataProvider()`는 **변경하지 않는다** → market-isr이 쓰는 raw provider 유지.

### §2-3. 적용 지점 (3곳 — 모두 market-isr 미접촉 파일)

| 파일 | 변경 |
|---|---|
| `entities/bars/actions/getBarsAction.ts` | `getMarketDataProvider()` → `getCachedMarketDataProvider()` |
| `entities/analysis/actions/submitAnalysisAction.ts:57` | 동일 |
| `entities/analysis/actions/submitOverallAnalysisAction.ts:120` | 동일 |

- 차트(`getBarsAction` → `getCachedBarsWithIndicators` → `fetchBarsWithIndicators` → provider.getBars):
  cold 시 provider 캐시를 워밍. 기존 `getCachedBarsWithIndicators`(indicators 결과 캐시)는 **유지**(옵션 A).
- 차트 1Day의 `getDailyBars` 내부 `fetchTodayQuoteBar`(provider.getQuote)도 캐시 provider를 거침 → quote 캐시.
- 분석: 결과 cache-miss 시 `fetchBarsWithIndicators(provider)`가 provider 캐시 hit → FMP 0.
  fear&greed용 1Day bars 중복 호출도 같은 `bars:raw:…:1Day:…` 키로 흡수.

### 캐시 레이어 (차트 경로, 옵션 A)

| 계층 | 차트 | 분석 |
|---|---|---|
| Next ISR (`getBarsStatic`, unstable_cache 1h) | ✅ | — |
| Redis (`getCachedBarsWithIndicators`, indicators 포함) | ✅ | — (분석은 안 거침) |
| **Redis (provider `bars:raw`/`quote`, 신규)** | ✅ (cold 워밍) | ✅ |

---

## 설계 — §3. 테스트 (커버리지 90%+, Happy + Worst)

### earnings
- **`isEarningsReportStale.test.ts`** (신규): (H) `fetchedAt` 24h 이내 → false / (W) `null` → true,
  24h 초과 → true, 경계값(정확히 24h).
- **`newsData.test.ts`** (수정): 기존 "fresh인데 빈 comparisonItems → FMP 호출" 테스트(line 95-107)를
  **새 동작**으로 교체 — (H) "fresh면 빈 결과여도 refetch 안 함"(`getEarningsReports` 미호출),
  (W) "stale(또는 null)이면 빈 결과 시 refetch + upsert". 기존 stale 경로 실패 테스트(line 110-174)는
  영향 없음(이미 staleFetchedAt 사용).

### provider 캐시
- **`CachedMarketDataProvider.test.ts`** (신규, `CachedFundamentalProvider.test.ts` 패턴 미러링):
  - (H) `getBars` miss→fetch→set(키 `bars:raw:…`), hit→캐시값(inner 1회). `getQuote` 동일(키 `quote:SYM`).
  - (H) 심볼 대문자화. `from`/`before` 다르면 키 분리.
  - (W) 빈 봉(`[]`) 미캐싱, null quote 미캐싱(`store` 미저장 + inner 재호출).
  - (W) inner throw → 전파 + 미캐싱. Redis 부재(null client) → inner 직접 호출, `store.size===0`.
- **`getCachedMarketDataProvider.test.ts`** (신규): 싱글톤(동일 인스턴스), E2E면 `getMarketDataProvider()`와
  동일(Fake), 비-E2E면 `CachedMarketDataProvider` instanceof.

> 기존 `getMarketDataProvider.test.ts`는 **변경 없음**(getMarketDataProvider 자체를 안 바꾸므로 그대로 통과).

---

## §4. 검증 전략

- `yarn test`(워크트리, 하드링크 node_modules) — 변경면 + 신규 테스트 통과.
- `yarn lint` — boundaries/import 규칙 통과(shared/api/market은 shared/cache import 허용).
- pre-push full gate(`--no-verify` 금지 — 메모리 규약). build는 파이프 없이 exit code 직접 캡처.

---

## §5. market-isr과의 경계 (충돌 0)

| 영역 | 본 작업 | market-isr |
|---|---|---|
| `getMarketDataProvider()` | **무변경** | raw provider 사용(여러 헬퍼 주입) |
| `getCachedMarketDataProvider`(신규) | 분석/차트 전용 주입 | 미사용 |
| `getMarketSummaryAction.ts` | **무접촉** | 제거 + 3개로 분리 재작성 |
| sector signals 캐시 | **무접촉** | `getCachedSectorSignals` 신설 |
| `getBarsAction`/분석 액션 | provider 교체 | 무접촉 |
| earnings(fundamental) | gate 수정 | 무접촉 |

**공유 파일 0** → 두 워크트리 병행 안전.

### market-isr 작업자에게 전달 권장 (본 작업 범위 밖)

market-isr §A-3은 *"현재 sector signals는 Redis 계층이 통째로 없다"* 고 기술하나, 검증 결과
**core `sectorSignals.js`가 이미 자체 Redis 캐시를 작동 중**이다(`createCacheProvider()` — 동일 UPSTASH env로 연결
+ `buildSectorSignalsCacheKey(timeframe, bucket)` + `SECTOR_SIGNALS_TTL_BY_TIMEFRAME`). 신설하려는
`getCachedSectorSignals`는 "빠진 계층 신설"이 아니라 core 기존 캐시 위에 또 한 겹을 얹는 것이다
(core는 time-bucket 키, 신규는 tf 키 — 둘 다 살아 중첩 가능). 설계 재검토 권장.

---

## §6. 리스크 / 미해결

- **이중 저장(공간)**: 차트 경로는 `getCachedBarsWithIndicators`(indicators 포함) + provider `bars:raw`
  두 키에 bars가 저장됨(옵션 A 채택 결과). 동작 무해, Redis 공간 약간 증가. indicators 재계산 회피
  가치가 더 크다고 판단해 유지.
- **fear&greed 1Day 중복의 완전 제거**: core 내부 중복 호출 코드 자체는 남는다(provider 캐시로 FMP 실제
  호출만 1회 수렴). 코드 레벨 제거는 core PR 필요 — 후속 선택지(본 작업 범위 밖).
- **`from` 날짜 경계**: core `fetchBarsWithIndicators`의 `computeFromDay`가 `now` 기반이라 자정 경계에서
  하루가 바뀌면 키가 달라져 캐시 miss 1회 발생. TTL이 짧아(장중 60s) 영향 미미.
