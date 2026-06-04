# FMP 캐시 개선 (earnings gate + 분석/차트 provider 캐시) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** earnings DB gate의 영구 cache-miss 루프를 제거하고, 분석/차트 경로의 bars/quote가 FMP를 직격하지 않도록 provider 레벨 Redis 캐시를 분석/차트 전용으로 도입한다.

**Architecture:** (1) `isEarningsReportStale(fetchedAt)` 공통 함수로 staleness 판정을 `fetchedAt` 단독 기준으로 통일. (2) `CachedMarketDataProvider` 데코레이터(getOrSetCache 래핑)를 `getCachedMarketDataProvider()` 전용 팩토리로 분석/차트 액션 3곳에만 주입 — `getMarketDataProvider()` 싱글톤은 무변경(market-isr 충돌 회피).

**Tech Stack:** TypeScript, Next.js(Server Actions), Upstash Redis(`getOrSetCache`), Vitest, FSD 레이어, `@y0ngha/siglens-core`(무변경).

**Worktree:** `/Users/y0ngha/Project/siglens-earnings-stale` (브랜치 `fix/fmp-cache-and-earnings-gate`, node_modules `cp -al` 하드링크 완료). 모든 경로는 이 워크트리 기준.

**Spec:** `docs/superpowers/specs/2026-06-04-fmp-cache-and-earnings-gate-design.md`

**커밋 정책 (이 레포 override):** task별 커밋을 하지 **않는다**. 전체 구현 완료 후 `review-agent → mistake-managing-agent → git-agent` 워크플로우로 일괄 커밋한다(CLAUDE.md: 커밋은 git-agent 책임). 각 task는 test→fail→impl→pass 사이클까지만 수행한다.

**테스트 실행 주의:** 워크트리에서 `yarn test <경로>`로 단일 파일 실행. 단일 테스트는 `yarn test <경로> -t "<이름>"`.

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `src/entities/earnings-report/lib/isEarningsReportStale.ts` | earnings DB row staleness 판정(순수 함수) | 신규 |
| `src/entities/earnings-report/__tests__/lib/isEarningsReportStale.test.ts` | 위 함수 테스트 | 신규 |
| `src/entities/earnings-report/index.ts` | barrel export 추가 | 수정 |
| `src/entities/earnings-report/lib/nextEarningsReport.ts` | 중복 staleness 로직 제거 → 공통 함수 사용 | 수정 |
| `src/app/[symbol]/news/newsData.ts` | gate 우회 조건 제거 → 공통 함수 사용 | 수정 |
| `src/app/[symbol]/news/__tests__/newsData.test.ts` | gate 동작 변경 반영 | 수정 |
| `src/shared/api/market/CachedMarketDataProvider.ts` | MarketDataProvider Redis 캐시 데코레이터 | 신규 |
| `src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts` | 데코레이터 테스트 | 신규 |
| `src/shared/api/market/getCachedMarketDataProvider.ts` | 분석/차트 전용 캐시 provider 싱글톤 팩토리 | 신규 |
| `src/shared/api/market/__tests__/getCachedMarketDataProvider.test.ts` | 팩토리 테스트 | 신규 |
| `src/entities/bars/actions/getBarsAction.ts` | provider 주입 교체 | 수정 |
| `src/entities/analysis/actions/submitAnalysisAction.ts` | provider 주입 교체 | 수정 |
| `src/entities/analysis/actions/submitOverallAnalysisAction.ts` | provider 주입 교체 | 수정 |

---

## Task 1: `isEarningsReportStale` 공통 함수

**Files:**
- Create: `src/entities/earnings-report/lib/isEarningsReportStale.ts`
- Test: `src/entities/earnings-report/__tests__/lib/isEarningsReportStale.test.ts`
- Modify: `src/entities/earnings-report/index.ts`

- [ ] **Step 1: Write the failing test**

`src/entities/earnings-report/__tests__/lib/isEarningsReportStale.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    EARNINGS_REPORT_STALE_MS,
    isEarningsReportStale,
} from '@/entities/earnings-report/lib/isEarningsReportStale';
import { MS_PER_DAY } from '@/shared/config/time';

describe('isEarningsReportStale', () => {
    afterEach(() => vi.useRealTimers());

    it('fetchedAt이 null이면 stale(true) — 첫 방문', () => {
        expect(isEarningsReportStale(null)).toBe(true);
    });

    it('24시간 이내면 fresh(false)', () => {
        expect(isEarningsReportStale(new Date(Date.now() - 1000))).toBe(false);
    });

    it('24시간 초과면 stale(true)', () => {
        expect(
            isEarningsReportStale(new Date(Date.now() - (MS_PER_DAY + 1000)))
        ).toBe(true);
    });

    it('정확히 24시간 경계는 fresh(false) — 초과(>)만 stale', () => {
        vi.useFakeTimers();
        const now = new Date('2026-06-04T00:00:00Z');
        vi.setSystemTime(now);
        expect(
            isEarningsReportStale(new Date(now.getTime() - MS_PER_DAY))
        ).toBe(false);
    });

    it('EARNINGS_REPORT_STALE_MS는 24시간(MS_PER_DAY)', () => {
        expect(EARNINGS_REPORT_STALE_MS).toBe(MS_PER_DAY);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/entities/earnings-report/__tests__/lib/isEarningsReportStale.test.ts`
Expected: FAIL — `Failed to resolve import ".../isEarningsReportStale"` (파일 없음).

- [ ] **Step 3: Write minimal implementation**

`src/entities/earnings-report/lib/isEarningsReportStale.ts`:

```ts
import { MS_PER_DAY } from '@/shared/config/time';

/**
 * earnings DB row가 stale(재fetch 필요)인지 — `fetchedAt` 단독 기준.
 *
 * news 페이지(getEarningsReportComparison)와 분석 경로(getNextEarningsReport)가
 * 이 함수를 공유해 staleness 판정을 단일화한다. 이전 news 경로는 "표시할 비교
 * 데이터 없음(comparisonItems.length === 0)"을 추가 OR 조건으로 두어, fetchedAt이
 * 방금 갱신된 종목도 매 요청 FMP refetch하는 영구 cache-miss 루프가 있었다. 표시
 * 가능 여부는 staleness와 무관하므로 fetchedAt만으로 판정한다.
 */
export const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;

export function isEarningsReportStale(fetchedAt: Date | null): boolean {
    return (
        fetchedAt === null ||
        Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS
    );
}
```

- [ ] **Step 4: Add barrel export**

`src/entities/earnings-report/index.ts` — `// lib` 주석 아래 줄에 추가:

```ts
export { getNextEarningsReport } from './lib/nextEarningsReport';
export {
    EARNINGS_REPORT_STALE_MS,
    isEarningsReportStale,
} from './lib/isEarningsReportStale';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test src/entities/earnings-report/__tests__/lib/isEarningsReportStale.test.ts`
Expected: PASS (5 tests).

---

## Task 2: `nextEarningsReport.ts` 중복 staleness 로직 제거

**Files:**
- Modify: `src/entities/earnings-report/lib/nextEarningsReport.ts`
- Test(기존): `src/entities/earnings-report/__tests__/lib/nextEarningsReport.test.ts` (동작 불변 — 통과 유지)

- [ ] **Step 1: Refactor to shared function**

`src/entities/earnings-report/lib/nextEarningsReport.ts` 전체를 아래로 교체 (import에서 `MS_PER_DAY` 제거, 로컬 `EARNINGS_REPORT_STALE_MS` 제거, inline `isStale` → `isEarningsReportStale`):

```ts
import type { EarningsCalendarItem } from '@y0ngha/siglens-core';
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report';
import { isEarningsReportStale } from './isEarningsReportStale';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import type { SiglensDatabase } from '@/shared/db/types';

const EARNINGS_REPORT_FMP_LIMIT = 5;

/**
 * Returns the next upcoming earnings entry for `symbol`, refreshing from FMP if
 * the DB has no data or the last fetch is older than 24 hours.
 * Used by analysis actions that run independently of the news page visit.
 */
export async function getNextEarningsReport(
    symbol: string,
    db: SiglensDatabase
): Promise<EarningsCalendarItem | null> {
    const repo = new DrizzleEarningsReportsRepository(db);
    const fetchedAt = await repo.getLatestFetchedAt(symbol);

    if (isEarningsReportStale(fetchedAt)) {
        try {
            const client = getFundamentalDataProvider();
            const reports = await client.getEarningsReports(
                symbol,
                EARNINGS_REPORT_FMP_LIMIT
            );
            await repo.upsertMany(reports);
        } catch {
            // Best-effort: analysis proceeds without earnings context if FMP fails
        }
    }

    return repo.getNextForSymbol(symbol, todayKstIsoDate());
}
```

> 주의: 같은 `lib/` 폴더라 `./isEarningsReportStale` 상대 import 사용(barrel `@/entities/earnings-report`로 import하면 nextEarningsReport↔barrel 순환 위험). lib/ 내부 상대 import는 CLAUDE.md 예외.

- [ ] **Step 2: Run existing test to verify still passes**

Run: `yarn test src/entities/earnings-report/__tests__/lib/nextEarningsReport.test.ts`
Expected: PASS (6 tests — 동작 동일하므로 변경 없이 통과). null/stale/fresh 케이스가 그대로 검증된다.

---

## Task 3: `newsData.ts` gate 우회 조건 제거

**Files:**
- Modify: `src/app/[symbol]/news/newsData.ts`
- Modify: `src/app/[symbol]/news/__tests__/newsData.test.ts`

- [ ] **Step 1: Update the test to the new behavior**

`src/app/[symbol]/news/__tests__/newsData.test.ts`의 `describe('DB 캐시가 유효할 때', ...)` 블록 안에서 **기존 `it('비교 데이터가 비어 있으면 FMP 로 정규화 데이터를 채운다', ...)` 테스트(약 line 95-107)를 아래 2개로 교체**:

```ts
        it('fetchedAt이 fresh면 비교 데이터가 비어 있어도 FMP를 재호출하지 않는다 (24h gate 우회 방지)', async () => {
            mockGetComparisonItems.mockResolvedValue([]);
            // beforeEach: mockGetLatestFetchedAt = new Date() (fresh)

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([]);

            expect(mockGetEarningsReports).not.toHaveBeenCalled();
            expect(mockUpsertMany).not.toHaveBeenCalled();
        });

        it('stale 상태에서 비교 데이터가 비어 있으면 FMP 로 정규화 데이터를 채운다', async () => {
            const staleFetchedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
            mockGetLatestFetchedAt.mockResolvedValue(staleFetchedAt);
            mockGetComparisonItems
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([COMPARISON_ITEM]);

            await expect(
                getEarningsReportComparison('AAPL', '2026-05-10')
            ).resolves.toEqual([COMPARISON_ITEM]);

            expect(mockGetEarningsReports).toHaveBeenCalledWith('AAPL', 5);
            expect(mockUpsertMany).toHaveBeenCalledWith([COMPARISON_ITEM]);
            expect(mockGetComparisonItems).toHaveBeenCalledTimes(2);
        });
```

> 나머지 테스트(`갱신 실패 시 ...` 4개)는 모두 `staleFetchedAt`(25h)을 쓰므로 새 동작에서도 그대로 통과 — 변경 없음.

- [ ] **Step 2: Run test to verify the new fresh-case test fails**

Run: `yarn test src/app/[symbol]/news/__tests__/newsData.test.ts -t "fetchedAt이 fresh면 비교 데이터가 비어"`
Expected: FAIL — 현재 코드(조건 A 존재)는 fresh여도 빈 결과면 FMP를 호출하므로 `mockGetEarningsReports`가 호출됨.

- [ ] **Step 3: Update `newsData.ts`**

`src/app/[symbol]/news/newsData.ts` 변경:

(a) import 교체 — `MS_PER_DAY` import 줄 제거, earnings-report barrel에 `isEarningsReportStale` 추가:

```ts
import { DrizzleEarningsReportsRepository, isEarningsReportStale } from '@/entities/earnings-report';
```

기존:
```ts
import { DrizzleEarningsReportsRepository } from '@/entities/earnings-report';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import {
    getFmpUserFacingMessage,
    isFmpPaymentRequiredError,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { MS_PER_DAY } from '@/shared/config/time';
```
→ `MS_PER_DAY` import 줄 삭제, `DrizzleEarningsReportsRepository` import에 `isEarningsReportStale` 병합.

(b) 로컬 상수 제거 — 아래 줄 삭제:
```ts
const EARNINGS_REPORT_STALE_MS = MS_PER_DAY;
```

(c) gate 호출 교체 — `getEarningsReportComparison` 내부:
```ts
    if (shouldRefreshEarningsReports(fetchedAt, comparisonItems)) {
```
→
```ts
    if (isEarningsReportStale(fetchedAt)) {
```

(d) `shouldRefreshEarningsReports` 함수 정의(파일 하단 약 line 76-85) **전체 삭제**:
```ts
function shouldRefreshEarningsReports(
    fetchedAt: Date | null,
    comparisonItems: EarningsReportComparisonItem[]
): boolean {
    return (
        comparisonItems.length === 0 ||
        fetchedAt === null ||
        Date.now() - fetchedAt.getTime() > EARNINGS_REPORT_STALE_MS
    );
}
```

> `EARNINGS_REPORT_FMP_LIMIT`, `comparisonItems`(fetch 후 재조회·반환용), 나머지 로직은 유지. `EarningsReportComparisonItem` 타입 import가 `shouldRefreshEarningsReports`에서만 쓰였다면 미사용 import 경고가 날 수 있으니 확인 — `getEarningsReportComparison` 반환 타입에서 여전히 사용되므로 유지된다.

- [ ] **Step 4: Run test to verify all pass**

Run: `yarn test src/app/[symbol]/news/__tests__/newsData.test.ts`
Expected: PASS (기존 + 신규 모두). fresh-case는 FMP 미호출, stale-case는 FMP 호출.

---

## Task 4: `CachedMarketDataProvider` 데코레이터

**Files:**
- Create: `src/shared/api/market/CachedMarketDataProvider.ts`
- Test: `src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`

- [ ] **Step 1: Write the failing test**

`src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts` (패턴 참고: `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedMarketDataProvider } from '@/shared/api/market/CachedMarketDataProvider';
import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketQuote,
} from '@y0ngha/siglens-core';

// 인메모리 fake Redis (envelope {data} 그대로 저장/반환).
const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(async (key: string, value: unknown) => {
            store.set(key, value);
        }),
    };
    return { store, fakeRedis };
});
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

const SAMPLE_BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
];
const SAMPLE_QUOTE: MarketQuote = {
    symbol: 'AAPL',
    price: 1.5,
    changesPercentage: 1.2,
    name: 'Apple',
};

function makeInner(
    overrides: Partial<MarketDataProvider> = {}
): MarketDataProvider {
    return {
        getBars: vi.fn(async () => SAMPLE_BARS),
        getQuote: vi.fn(async () => SAMPLE_QUOTE),
        ...overrides,
    } as MarketDataProvider;
}

const barsOpts = (o: Partial<GetBarsOptions> = {}): GetBarsOptions => ({
    symbol: 'aapl',
    timeframe: '1Day',
    from: '2026-01-01',
    ...o,
});

function reset() {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
}

describe('CachedMarketDataProvider', () => {
    beforeEach(reset);

    it('getBars: miss→fetch→set, hit→캐시값(키 bars:raw:SYM:TF:from:before)', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);

        const first = await p.getBars(barsOpts());
        expect(first).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01:')).toBe(true);

        const second = await p.getBars(barsOpts());
        expect(second).toEqual(SAMPLE_BARS);
        expect(inner.getBars).toHaveBeenCalledTimes(1); // 캐시 hit
    });

    it('getBars: 빈 배열은 캐싱하지 않는다(transient 가드)', async () => {
        const inner = makeInner({ getBars: vi.fn(async () => []) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(await p.getBars(barsOpts())).toEqual([]);
        expect(inner.getBars).toHaveBeenCalledTimes(2);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01:')).toBe(false);
    });

    it('getBars: from/before가 다르면 키가 분리된다', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        await p.getBars(barsOpts({ from: '2026-01-01' }));
        await p.getBars(barsOpts({ from: '2026-02-01' }));
        await p.getBars(barsOpts({ from: '2026-01-01', before: '2026-03-01' }));
        expect(inner.getBars).toHaveBeenCalledTimes(3);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01:')).toBe(true);
        expect(store.has('bars:raw:AAPL:1Day:2026-02-01:')).toBe(true);
        expect(store.has('bars:raw:AAPL:1Day:2026-01-01:2026-03-01')).toBe(true);
    });

    it('getBars: inner throw는 전파되고 캐싱되지 않는다(worst case)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getBars: boom });
        const p = new CachedMarketDataProvider(inner);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(store.size).toBe(0);
        await expect(p.getBars(barsOpts())).rejects.toThrow('FMP 502');
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getQuote: miss→fetch→set(quote:SYM), hit→캐시값, 심볼 대문자화', async () => {
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        const first = await p.getQuote('aapl');
        expect(first).toEqual(SAMPLE_QUOTE);
        expect(inner.getQuote).toHaveBeenCalledTimes(1);
        expect(store.has('quote:AAPL')).toBe(true);
        await p.getQuote('aapl');
        expect(inner.getQuote).toHaveBeenCalledTimes(1);
    });

    it('getQuote: null(미가용)은 캐싱하지 않는다', async () => {
        const inner = makeInner({ getQuote: vi.fn(async () => null) });
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(await p.getQuote('NODATA')).toBeNull();
        expect(inner.getQuote).toHaveBeenCalledTimes(2);
        expect(store.has('quote:NODATA')).toBe(false);
    });

    it('Redis 부재 시 inner로 fallback(worst case)', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const p = new CachedMarketDataProvider(inner);
        expect(await p.getBars(barsOpts())).toEqual(SAMPLE_BARS);
        expect(await p.getQuote('AAPL')).toEqual(SAMPLE_QUOTE);
        expect(store.size).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: FAIL — `Failed to resolve import ".../CachedMarketDataProvider"`.

- [ ] **Step 3: Write the implementation**

`src/shared/api/market/CachedMarketDataProvider.ts`:

```ts
import 'server-only';
import {
    type Bar,
    type GetBarsOptions,
    type MarketDataProvider,
    type MarketQuote,
    type Timeframe,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';

/** quote TTL은 bars 일봉 개장-경계 정책을 재사용 — timeframe과 무관한 placeholder. */
const QUOTE_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * FmpMarketProvider는 limit을 URL에 쓰지 않고(date-window 기반) symbol/timeframe/
 * from/before로만 결과가 결정되므로 키에서 limit을 제외한다.
 */
function buildBarsRawKey(o: GetBarsOptions): string {
    return `bars:raw:${o.symbol.toUpperCase()}:${o.timeframe}:${o.from ?? ''}:${o.before ?? ''}`;
}

/**
 * `MarketDataProvider`를 감싸 getBars/getQuote에 provider 레벨 Redis 캐싱을 주입하는
 * 데코레이터. 분석/차트 경로가 동일 provider를 거치므로(차트 getBarsAction, 분석
 * submitAnalysis/submitOverallAnalysis), 여기서 캐싱하면 차트·분석·today-quote·
 * fear&greed 1Day가 같은 캐시를 공유한다 — 분석 결과 cache-miss 시 차트가 워밍한
 * bars를 재사용해 FMP 직격을 막는다. `CachedFundamentalProvider` 패턴과 동형이다.
 *
 * inner.getBars가 FMP 장애로 throw하면 getOrSetCache의 set 전에 전파되어 장애가
 * 캐싱되지 않는다(poison 방지). 빈 봉/ null quote는 shouldCache 가드로 미캐싱해
 * transient 결과를 TTL 동안 굳히지 않는다. Redis 미설정/장애 시 getOrSetCache가
 * graceful fallback(inner 직접 호출)한다.
 *
 * market summary/sector signals 경로는 이 데코레이터를 쓰지 않는다(getMarketDataProvider
 * raw 사용 — market-isr 전담). 적용은 getCachedMarketDataProvider 팩토리가 담당.
 */
export class CachedMarketDataProvider implements MarketDataProvider {
    constructor(private readonly inner: MarketDataProvider) {}

    getBars = (options: GetBarsOptions): Promise<Bar[]> =>
        getOrSetCache(
            buildBarsRawKey(options),
            computeBarsEffectiveTtl(options.timeframe, new Date()),
            () => this.inner.getBars(options),
            bars => bars.length > 0
        );

    getQuote = (symbol: string): Promise<MarketQuote | null> =>
        getOrSetCache(
            `quote:${symbol.toUpperCase()}`,
            computeBarsEffectiveTtl(QUOTE_TTL_TIMEFRAME, new Date()),
            () => this.inner.getQuote(symbol),
            quote => quote !== null
        );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/api/market/__tests__/CachedMarketDataProvider.test.ts`
Expected: PASS (7 tests).

---

## Task 5: `getCachedMarketDataProvider` 팩토리

**Files:**
- Create: `src/shared/api/market/getCachedMarketDataProvider.ts`
- Test: `src/shared/api/market/__tests__/getCachedMarketDataProvider.test.ts`

- [ ] **Step 1: Write the failing test**

`src/shared/api/market/__tests__/getCachedMarketDataProvider.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// isE2E를 케이스별로 제어. getMarketDataProvider도 isE2E를 보므로 동일 mock을 공유.
const { mockIsE2E } = vi.hoisted(() => ({ mockIsE2E: vi.fn(() => false) }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));

beforeEach(() => {
    // 모듈 레벨 싱글톤(cached) 격리를 위해 매 테스트 모듈 리셋.
    vi.resetModules();
    mockIsE2E.mockReturnValue(false);
});

describe('getCachedMarketDataProvider', () => {
    it('같은 인스턴스를 반환한다(singleton)', async () => {
        const { getCachedMarketDataProvider } = await import(
            '@/shared/api/market/getCachedMarketDataProvider'
        );
        expect(getCachedMarketDataProvider()).toBe(getCachedMarketDataProvider());
    });

    it('비-E2E면 CachedMarketDataProvider를 반환한다', async () => {
        mockIsE2E.mockReturnValue(false);
        const { getCachedMarketDataProvider } = await import(
            '@/shared/api/market/getCachedMarketDataProvider'
        );
        const { CachedMarketDataProvider } = await import(
            '@/shared/api/market/CachedMarketDataProvider'
        );
        expect(getCachedMarketDataProvider()).toBeInstanceOf(
            CachedMarketDataProvider
        );
    });

    it('E2E면 raw provider(getMarketDataProvider)와 동일 인스턴스를 반환한다(Fake)', async () => {
        mockIsE2E.mockReturnValue(true);
        const { getCachedMarketDataProvider } = await import(
            '@/shared/api/market/getCachedMarketDataProvider'
        );
        const { getMarketDataProvider } = await import(
            '@/shared/api/market/getMarketDataProvider'
        );
        expect(getCachedMarketDataProvider()).toBe(getMarketDataProvider());
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test src/shared/api/market/__tests__/getCachedMarketDataProvider.test.ts`
Expected: FAIL — `Failed to resolve import ".../getCachedMarketDataProvider"`.

- [ ] **Step 3: Write the implementation**

`src/shared/api/market/getCachedMarketDataProvider.ts`:

```ts
import 'server-only';
import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { getMarketDataProvider } from './getMarketDataProvider';
import { CachedMarketDataProvider } from './CachedMarketDataProvider';
import { isE2E } from '@/shared/api/e2eEnv';

let cached: MarketDataProvider | null = null;

/**
 * 분석/차트 경로 전용 Redis 캐시 provider(싱글톤).
 *
 * `getMarketDataProvider()`(raw FMP provider, market summary/sector가 사용)는 그대로
 * 두고, 분석/차트 경로에만 이 캐시 데코레이터를 주입한다 — market-isr 작업과 공유
 * 파일을 만들지 않기 위함. E2E에서는 FakeMarketProvider(Redis 미설정이라 데코레이터
 * 무의미)를 그대로 반환한다.
 */
export function getCachedMarketDataProvider(): MarketDataProvider {
    if (cached !== null) return cached;
    cached = isE2E()
        ? getMarketDataProvider()
        : new CachedMarketDataProvider(getMarketDataProvider());
    return cached;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn test src/shared/api/market/__tests__/getCachedMarketDataProvider.test.ts`
Expected: PASS (3 tests).

---

## Task 6: 분석/차트 액션에 캐시 provider 주입 (3곳)

**Files:**
- Modify: `src/entities/bars/actions/getBarsAction.ts`
- Modify: `src/entities/analysis/actions/submitAnalysisAction.ts`
- Modify: `src/entities/analysis/actions/submitOverallAnalysisAction.ts`

- [ ] **Step 1: `getBarsAction.ts` provider 교체**

import 교체:
```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
```
→
```ts
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
```

호출 교체(`getCachedBarsWithIndicators(` 인자):
```ts
        return await getCachedBarsWithIndicators(
            getMarketDataProvider(),
```
→
```ts
        return await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(),
```

- [ ] **Step 2: `submitAnalysisAction.ts` provider 교체**

import 교체(line 16):
```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
```
→
```ts
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
```

호출 교체(line 57):
```ts
        const marketDataProvider = getMarketDataProvider();
```
→
```ts
        const marketDataProvider = getCachedMarketDataProvider();
```

- [ ] **Step 3: `submitOverallAnalysisAction.ts` provider 교체**

import 교체(line 15):
```ts
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
```
→
```ts
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
```

호출 교체(line 120):
```ts
            marketDataProvider: getMarketDataProvider(),
```
→
```ts
            marketDataProvider: getCachedMarketDataProvider(),
```

- [ ] **Step 4: 기존 액션 테스트의 mock 갱신 확인**

Run: `yarn test src/entities/bars src/entities/analysis`
Expected: 통과. 만약 기존 테스트가 `@/shared/api/market/getMarketDataProvider`를 `vi.mock`으로 가로채 provider를 주입했다면, 해당 mock 대상을 `@/shared/api/market/getCachedMarketDataProvider`로 변경해야 한다(동일 반환 형태). 실패 시 mock 경로만 교체 후 재실행.

> 확인 명령(실행자용): `grep -rn "getMarketDataProvider" src/entities/bars/__tests__ src/entities/analysis/__tests__` 로 mock 대상 존재 여부 점검.

---

## Task 7: 전체 검증 (테스트 + 린트)

**Files:** 없음(검증 전용)

- [ ] **Step 1: 변경/신규 영역 테스트**

Run: `yarn test src/entities/earnings-report src/app/[symbol]/news src/shared/api/market src/entities/bars src/entities/analysis`
Expected: 전부 PASS.

- [ ] **Step 2: 전체 테스트 스위트**

Run: `yarn test`
Expected: 전부 PASS (회귀 0).

- [ ] **Step 3: 린트**

Run: `yarn lint`
Expected: 0 errors. (boundaries 규칙: `shared/api/market` → `shared/cache`, `@y0ngha/siglens-core` import 허용. `app`/`entities` → 신규 barrel/팩토리 import 허용.)

- [ ] **Step 4: 워크플로우 진입 (커밋은 직접 하지 않음)**

구현·검증 완료. CLAUDE.md 라우팅에 따라 다음 순서로 진행:
`review-agent`(Opus 4.8로 spawn) → findings 수정 → 재리뷰 → `mistake-managing-agent` → `git-agent`(커밋·푸시·PR). spec/plan 문서도 git-agent가 함께 커밋한다.

---

## Self-Review (작성자 점검 완료)

- **Spec 커버리지**: §1 earnings gate → Task 1-3. §2 provider 캐시 → Task 4-6. §3 테스트 → 각 task의 test 스텝 + Task 7. §5 경계(getMarketDataProvider 무변경) → Task 5/6에서 보존. ✅
- **Placeholder 스캔**: 모든 code 스텝에 실제 코드 포함. "적절히/TODO" 없음. ✅
- **타입 일관성**: `isEarningsReportStale(fetchedAt: Date | null): boolean`, `EARNINGS_REPORT_STALE_MS`, `CachedMarketDataProvider`(getBars/getQuote), `getCachedMarketDataProvider()` — 전 task에서 명칭 일치. `MarketQuote`(symbol/price/changesPercentage/name), `Bar`(time/open/high/low/close/volume), `GetBarsOptions`(symbol/timeframe/from/before/limit) — core 실제 타입과 일치. ✅
- **키 정합성**: `bars:raw:SYM:TF:from:before`, `quote:SYM` — Task 4 impl과 test 동일. ✅
