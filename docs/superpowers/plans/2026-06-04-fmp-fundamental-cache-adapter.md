# FMP 펀더멘털 캐싱 데코레이터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FMP 펀더멘털 데이터의 Redis 캐싱을 분석 경로까지 통일하고(분석 경로의 Redis 우회 제거), key-metrics/ratios 이중 fetch를 제거하며, peer PER/PSR enrich를 통일한다.

**Architecture:** `getFundamentalDataProvider()` 팩토리가 raw `FmpFundamentalClient`를 `CachedFundamentalProvider` 데코레이터로 감싸 반환한다. 데코레이터는 각 메서드를 `getOrSetCache`(기존 `fundamental:*` 키 / 1h)로 감싸므로, 페이지 SSR과 core 분석 경로가 동일 캐시를 공유한다. inner client는 km-ttm/r-ttm raw fetch를 공통 `getValuationRaw` 헬퍼(`React.cache` 메모이즈)로 합쳐 이중 fetch를 없앤다. core 코드 변경 없음.

**Tech Stack:** TypeScript, Next.js 16 (RSC/Server Actions), `react` `cache()`, Upstash Redis (`getOrSetCache`), Vitest, `@y0ngha/siglens-core` (`FundamentalDataProvider` 포트).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/shared/api/fmp/fundamentalClient.ts` (수정) | inner client. km-ttm/r-ttm를 `getValuationRaw`로 합치고 `React.cache` 메모이즈 |
| `src/shared/api/fmp/CachedFundamentalProvider.ts` (신규) | 캐싱 데코레이터. `FundamentalProvider` 구현, 메서드별 `getOrSetCache` + peer enrich |
| `src/shared/api/fmp/getFundamentalDataProvider.ts` (수정) | prod에서 데코레이터 반환 (E2E Fake는 그대로) |
| `src/app/[symbol]/fundamental/fundamentalData.ts` (수정) | `getOrSetCache`·enrich 제거, provider 위임 |
| `src/app/[symbol]/news/newsData.ts` (수정) | `getGradeEvents`의 `getOrSetCache` 제거, provider 위임 |
| `src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts` (신규) | `getValuationRaw` + km/r 가공 + 이중 fetch 제거 |
| `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts` (신규) | 캐시 히트/미스, 키, enrich, pass-through, worst case |

**테스트 커버리지 목표: 신규 파일 90% 이상** (`yarn test-coverage`로 측정).

**E2E:** 신규 E2E 불필요 — 캐시 히트/미스는 단위 테스트로 정확히 검증 가능하고 E2E로는 관측이 어렵다. 기존 E2E 스위트(펀더멘털 페이지·분석)가 회귀 가드 역할을 한다. Task 8에서 기존 스위트 영향만 확인한다.

---

## 사전 참고 (구현 전 읽기)

- `src/shared/cache/getOrSetCache.ts` — `getOrSetCache(key, ttlSeconds, fetcher, shouldCache?)`. 값은 `{ data }` envelope으로 저장, null/빈 배열도 캐싱, Redis 미설정/장애 시 `fetcher()` 직접 호출(graceful fallback).
- `src/shared/api/fmp/fundamentalClient.ts` — `FMP_FUNDAMENTAL_REVALIDATE_SECONDS`(=3600), `getOptionalArray`, `FmpEarningsReportItem`.
- `src/shared/api/fmp/getFundamentalDataProvider.ts` — `FundamentalProvider` 인터페이스(= 포트 + `getGrades` required + `getEarningsReports`).
- `docs/SCOPE.md` — core의 분석 결과 캐시/Job 큐/쿨다운은 건드리지 않는다(이번 범위 밖).

---

## Task 1: inner client — `getValuationRaw`로 km/r 이중 fetch 제거

`getKeyMetricsTtm`·`getRatiosTtm`가 각각 두 엔드포인트를 fetch하던 것을, 공통 `getValuationRaw`(React.cache 메모이즈) 하나로 합친다.

**Files:**
- Modify: `src/shared/api/fmp/fundamentalClient.ts`
- Test: `src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// React.cache를 동기 메모이즈 stub으로 대체 — 비-RSC(vitest) 컨텍스트에서도
// same-request dedup을 검증하기 위함. 인스턴스별 격리는 각 it()에서 새 client로 보장.
vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            const store = new Map<string, R>();
            return (...args: A): R => {
                const key = JSON.stringify(args);
                if (!store.has(key)) store.set(key, fn(...args));
                return store.get(key) as R;
            };
        },
    };
});

const fmpGet = vi.fn();
vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: (...args: unknown[]) => fmpGet(...args),
    FMP_STABLE_BASE: 'https://example.test/stable',
}));

import { FmpFundamentalClient } from '@/shared/api/fmp/fundamentalClient';

beforeEach(() => {
    fmpGet.mockReset();
});

describe('FmpFundamentalClient valuation fetch sharing', () => {
    it('getKeyMetricsTtm + getRatiosTtm in same request fetch each endpoint once', async () => {
        fmpGet.mockImplementation((path: string) => {
            if (path === 'key-metrics-ttm')
                return Promise.resolve([{ peRatioTTM: 10, returnOnEquityTTM: 0.2 }]);
            if (path === 'ratios-ttm')
                return Promise.resolve([{ priceToSalesRatioTTM: 3, netProfitMarginTTM: 0.15 }]);
            return Promise.resolve([]);
        });

        const client = new FmpFundamentalClient();
        const [km, ratios] = await Promise.all([
            client.getKeyMetricsTtm('AAPL'),
            client.getRatiosTtm('AAPL'),
        ]);

        expect(km?.peRatioTTM).toBe(10);
        expect(km?.priceToSalesRatioTTM).toBe(3);
        expect(ratios?.netProfitMarginTTM).toBe(0.15);

        const kmCalls = fmpGet.mock.calls.filter(c => c[0] === 'key-metrics-ttm');
        const rCalls = fmpGet.mock.calls.filter(c => c[0] === 'ratios-ttm');
        expect(kmCalls).toHaveLength(1);
        expect(rCalls).toHaveLength(1);
    });

    it('returns null when both endpoints are empty (worst case)', async () => {
        fmpGet.mockResolvedValue([]);
        const client = new FmpFundamentalClient();
        expect(await client.getKeyMetricsTtm('ZZZZ')).toBeNull();
        expect(await client.getRatiosTtm('ZZZZ')).toBeNull();
    });

    it('falls back to key-metrics fields when ratios endpoint is empty', async () => {
        fmpGet.mockImplementation((path: string) =>
            path === 'key-metrics-ttm'
                ? Promise.resolve([{ peRatioTTM: 12, pbRatioTTM: 2, returnOnEquityTTM: 0.3 }])
                : Promise.resolve([])
        );
        const client = new FmpFundamentalClient();
        const km = await client.getKeyMetricsTtm('MSFT');
        expect(km?.peRatioTTM).toBe(12);
        expect(km?.pbRatioTTM).toBe(2);
        const ratios = await client.getRatiosTtm('MSFT');
        expect(ratios?.returnOnEquityTTM).toBe(0.3);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts`
Expected: FAIL — 현재 `getKeyMetricsTtm`+`getRatiosTtm`가 km-ttm/r-ttm을 각 2회 fetch하므로 `kmCalls`/`rCalls` 길이가 2.

- [ ] **Step 3: inner client 리팩토링**

`src/shared/api/fmp/fundamentalClient.ts` 상단 import에 `react` cache 추가:

```typescript
import { cache } from 'react';
```

`FmpFundamentalClient` 클래스 안에 private 헬퍼를 추가하고 두 메서드를 이 헬퍼 기반으로 교체한다. 기존 `getKeyMetricsTtm`(현 :130-164)·`getRatiosTtm`(현 :167-195) 본문을 다음으로 대체:

```typescript
    /**
     * key-metrics-ttm + ratios-ttm을 한 번에 fetch해 raw 쌍을 반환한다.
     * `React.cache`로 요청 스코프 메모이즈하므로, 같은 요청에서 getKeyMetricsTtm과
     * getRatiosTtm이 모두 호출돼도(분석 Promise.all) 각 엔드포인트 fetch는 1회로
     * 수렴한다. 두 메서드가 서로의 필드를 fallback으로 쓰므로 raw 쌍을 공유한다.
     */
    private getValuationRaw = cache(
        async (
            symbol: string
        ): Promise<{
            metrics: RawFmpKeyMetricsTtm | null;
            ratios: RawFmpRatiosTtm | null;
        }> => {
            const [arr, ratiosArr] = await Promise.all([
                getOptionalArray<RawFmpKeyMetricsTtm>('key-metrics-ttm', {
                    symbol,
                }),
                getOptionalArray<RawFmpRatiosTtm>('ratios-ttm', { symbol }),
            ]);
            return { metrics: arr[0] ?? null, ratios: ratiosArr[0] ?? null };
        }
    );

    /** Fetch TTM key metrics (valuation multiples + EPS); returns `null` when unavailable. */
    async getKeyMetricsTtm(
        symbol: string
    ): Promise<FundamentalValuationMetrics | null> {
        const { metrics, ratios } = await this.getValuationRaw(symbol);
        if (metrics === null && ratios === null) return null;
        return {
            peRatioTTM: toFiniteNumber(
                ratios?.priceToEarningsRatioTTM ?? metrics?.peRatioTTM
            ),
            priceToSalesRatioTTM: toFiniteNumber(
                ratios?.priceToSalesRatioTTM ?? metrics?.priceToSalesRatioTTM
            ),
            pbRatioTTM: toFiniteNumber(
                ratios?.priceToBookRatioTTM ?? metrics?.pbRatioTTM
            ),
            pegRatioTTM: toFiniteNumber(
                ratios?.priceToEarningsGrowthRatioTTM ?? metrics?.pegRatioTTM
            ),
            enterpriseValueOverEBITDATTM: toFiniteNumber(
                metrics?.evToEBITDATTM ??
                    ratios?.enterpriseValueMultipleTTM ??
                    metrics?.enterpriseValueOverEBITDATTM
            ),
            epsTTM: toFiniteNumber(
                ratios?.netIncomePerShareTTM ?? metrics?.epsTTM
            ),
        };
    }

    /** Fetch TTM profitability and financial health ratios; returns `null` when unavailable. */
    async getRatiosTtm(symbol: string): Promise<FundamentalRatiosInput | null> {
        const { metrics, ratios } = await this.getValuationRaw(symbol);
        if (ratios === null && metrics === null) return null;
        return {
            returnOnEquityTTM: toFiniteNumber(
                metrics?.returnOnEquityTTM ?? ratios?.returnOnEquityTTM
            ),
            returnOnAssetsTTM: toFiniteNumber(
                metrics?.returnOnAssetsTTM ?? ratios?.returnOnAssetsTTM
            ),
            operatingProfitMarginTTM: toFiniteNumber(
                ratios?.operatingProfitMarginTTM
            ),
            netProfitMarginTTM: toFiniteNumber(ratios?.netProfitMarginTTM),
            debtRatioTTM: toFiniteNumber(
                ratios?.debtToAssetsRatioTTM ?? ratios?.debtRatioTTM
            ),
            currentRatioTTM: toFiniteNumber(
                ratios?.currentRatioTTM ?? metrics?.currentRatioTTM
            ),
        };
    }
```

> 가공 로직(필드 매핑)은 기존과 동일하다 — fetch 구조만 `getValuationRaw`로 합쳤다. 기존 메서드의 `getOptionalArray` 두 호출은 제거된다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts`
Expected: PASS (km/r 각 1회 fetch, null/ fallback 케이스 통과).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/fundamentalClient.ts src/shared/api/fmp/__tests__/fundamentalClient.valuation.test.ts
git commit -m "refactor(fmp): share key-metrics/ratios raw fetch via getValuationRaw"
```

---

## Task 2: `CachedFundamentalProvider` — 단순 캐싱 메서드

1:1 캐싱 메서드들(profile, keyMetrics, ratios, cashFlow, growth, scores, estimates, grades, gradesConsensus, priceTargetConsensus, priceTargetSummary)을 먼저 구현한다. peer/sector/pass-through는 Task 3·4.

**Files:**
- Create: `src/shared/api/fmp/CachedFundamentalProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react')>();
    return {
        ...actual,
        cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
            const store = new Map<string, R>();
            return (...args: A): R => {
                const key = JSON.stringify(args);
                if (!store.has(key)) store.set(key, fn(...args));
                return store.get(key) as R;
            };
        },
    };
});

// 인메모리 fake Redis. envelope 포맷({data})을 그대로 저장/반환.
const store = new Map<string, unknown>();
const fakeRedis = {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
    set: vi.fn(async (key: string, value: unknown) => {
        store.set(key, value);
    }),
};
let redisEnabled = true;
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => (redisEnabled ? fakeRedis : null),
}));

import { CachedFundamentalProvider } from '@/shared/api/fmp/CachedFundamentalProvider';
import type { FundamentalProvider } from '@/shared/api/fmp/getFundamentalDataProvider';

function makeInner(overrides: Partial<FundamentalProvider> = {}): FundamentalProvider {
    return {
        getProfile: vi.fn(async (s: string) => ({
            symbol: s.toUpperCase(),
            companyName: 'X',
            sector: 'Tech',
            industry: 'SW',
            marketCap: 1e12,
            ceo: 'A',
            website: 'w',
            description: 'd',
        })),
        getKeyMetricsTtm: vi.fn(async () => ({
            peRatioTTM: 10,
            priceToSalesRatioTTM: 3,
            pbRatioTTM: null,
            pegRatioTTM: null,
            enterpriseValueOverEBITDATTM: null,
            epsTTM: null,
        })),
        getRatiosTtm: vi.fn(async () => null),
        getCashFlowStatement: vi.fn(async () => null),
        getIncomeStatementGrowth: vi.fn(async () => null),
        getFinancialScores: vi.fn(async () => null),
        getStockPeers: vi.fn(async () => []),
        getAnalystEstimates: vi.fn(async () => null),
        getGrades: vi.fn(async () => []),
        getGradesConsensus: vi.fn(async () => null),
        getPriceTargetConsensus: vi.fn(async () => null),
        getPriceTargetSummary: vi.fn(async () => null),
        getSectorPerformanceSnapshot: vi.fn(async () => []),
        getHistoricalSectorPerformance: vi.fn(async () => []),
        getEarningsReport: vi.fn(async () => null),
        getEarningsReports: vi.fn(async () => []),
        ...overrides,
    } as FundamentalProvider;
}

beforeEach(() => {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
});

describe('CachedFundamentalProvider — simple cached methods', () => {
    it('caches getProfile under fundamental:profile:<SYM> and uppercases symbol', async () => {
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);

        const first = await provider.getProfile('aapl');
        expect(first?.symbol).toBe('AAPL');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
        expect(store.has('fundamental:profile:AAPL')).toBe(true);

        // 두 번째 호출: 캐시 히트 → inner 재호출 없음
        const second = await provider.getProfile('aapl');
        expect(second?.symbol).toBe('AAPL');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
    });

    it('caches null result (no-data ticker) so it is not refetched', async () => {
        const inner = makeInner({ getCashFlowStatement: vi.fn(async () => null) });
        const provider = new CachedFundamentalProvider(inner);

        expect(await provider.getCashFlowStatement('NODATA')).toBeNull();
        expect(await provider.getCashFlowStatement('NODATA')).toBeNull();
        expect(inner.getCashFlowStatement).toHaveBeenCalledTimes(1);
    });

    it('caches empty array result for getGrades', async () => {
        const inner = makeInner({ getGrades: vi.fn(async () => []) });
        const provider = new CachedFundamentalProvider(inner);

        expect(await provider.getGrades('EMPTY')).toEqual([]);
        expect(await provider.getGrades('EMPTY')).toEqual([]);
        expect(inner.getGrades).toHaveBeenCalledTimes(1);
        expect(store.has('fundamental:grades:EMPTY')).toBe(true);
    });

    it('propagates inner errors WITHOUT caching them (worst case)', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getFinancialScores: boom });
        const provider = new CachedFundamentalProvider(inner);

        await expect(provider.getFinancialScores('ERR')).rejects.toThrow('FMP 502');
        expect(store.has('fundamental:scores:ERR')).toBe(false);
        // 재시도 시 다시 inner 호출(에러가 캐싱되지 않음)
        await expect(provider.getFinancialScores('ERR')).rejects.toThrow('FMP 502');
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('falls back to inner when Redis is unavailable (worst case)', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);

        const profile = await provider.getProfile('TSLA');
        expect(profile?.symbol).toBe('TSLA');
        expect(inner.getProfile).toHaveBeenCalledTimes(1);
        expect(store.size).toBe(0);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`
Expected: FAIL — `CachedFundamentalProvider` 모듈이 없음.

- [ ] **Step 3: 데코레이터 구현 (단순 메서드)**

Create `src/shared/api/fmp/CachedFundamentalProvider.ts`:

```typescript
import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { FMP_FUNDAMENTAL_REVALIDATE_SECONDS } from './fundamentalClient';
import type { FmpEarningsReportItem } from './fundamentalClient';
import type { FundamentalProvider } from './getFundamentalDataProvider';
import type {
    EarningsReport,
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalFinancialScoresInput,
    FundamentalGradesConsensusInput,
    FundamentalGrowthInput,
    FundamentalPeerInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
    FundamentalProfile,
    FundamentalRatiosInput,
    FundamentalSectorHistoricalInput,
    FundamentalSectorPerformanceInput,
    FundamentalValuationMetrics,
    GradesEvent,
} from '@y0ngha/siglens-core';

const TTL = FMP_FUNDAMENTAL_REVALIDATE_SECONDS;
const sym = (s: string): string => s.toUpperCase();

/**
 * `FundamentalProvider`를 감싸 메서드별 Redis 캐싱을 주입하는 데코레이터.
 *
 * 페이지 SSR(`fundamentalData.ts`)과 core 분석 경로(provider 주입)가 둘 다 이
 * 데코레이터를 통과하므로 동일한 `fundamental:*` 캐시를 공유한다 — 한쪽이 워밍한
 * 데이터를 다른 쪽이 재사용해 FMP 호출을 절감한다. 각 메서드는 `React.cache`로
 * 요청 스코프 dedup + `getOrSetCache`로 cross-request 캐싱을 적용한다(`barsDataCache`와
 * 동일 형태). 키/TTL은 기존 `fundamentalData.ts`·`newsData.ts` 스킴을 그대로 따른다.
 *
 * earnings(no-store + DB 영속)와 historical-sector(빈 stub)는 pass-through한다.
 */
export class CachedFundamentalProvider implements FundamentalProvider {
    constructor(private readonly inner: FundamentalProvider) {}

    getProfile = cache(
        (symbol: string): Promise<FundamentalProfile | null> =>
            getOrSetCache(`fundamental:profile:${sym(symbol)}`, TTL, () =>
                this.inner.getProfile(symbol)
            )
    );

    getKeyMetricsTtm = cache(
        (symbol: string): Promise<FundamentalValuationMetrics | null> =>
            getOrSetCache(`fundamental:key-metrics:${sym(symbol)}`, TTL, () =>
                this.inner.getKeyMetricsTtm(symbol)
            )
    );

    getRatiosTtm = cache(
        (symbol: string): Promise<FundamentalRatiosInput | null> =>
            getOrSetCache(`fundamental:ratios:${sym(symbol)}`, TTL, () =>
                this.inner.getRatiosTtm(symbol)
            )
    );

    getCashFlowStatement = cache(
        (symbol: string): Promise<FundamentalCashFlowInput | null> =>
            getOrSetCache(`fundamental:cash-flow:${sym(symbol)}`, TTL, () =>
                this.inner.getCashFlowStatement(symbol)
            )
    );

    getIncomeStatementGrowth = cache(
        (symbol: string): Promise<FundamentalGrowthInput | null> =>
            getOrSetCache(`fundamental:growth:${sym(symbol)}`, TTL, () =>
                this.inner.getIncomeStatementGrowth(symbol)
            )
    );

    getFinancialScores = cache(
        (symbol: string): Promise<FundamentalFinancialScoresInput | null> =>
            getOrSetCache(`fundamental:scores:${sym(symbol)}`, TTL, () =>
                this.inner.getFinancialScores(symbol)
            )
    );

    getAnalystEstimates = cache(
        (symbol: string): Promise<FundamentalAnalystEstimateInput | null> =>
            getOrSetCache(`fundamental:estimates:${sym(symbol)}`, TTL, () =>
                this.inner.getAnalystEstimates(symbol)
            )
    );

    getGrades = cache(
        (symbol: string): Promise<GradesEvent[]> =>
            getOrSetCache(`fundamental:grades:${sym(symbol)}`, TTL, () =>
                this.inner.getGrades(symbol)
            )
    );

    getGradesConsensus = cache(
        (symbol: string): Promise<FundamentalGradesConsensusInput | null> =>
            getOrSetCache(`fundamental:grades-consensus:${sym(symbol)}`, TTL, () =>
                this.inner.getGradesConsensus(symbol)
            )
    );

    getPriceTargetConsensus = cache(
        (symbol: string): Promise<FundamentalPriceTargetConsensusInput | null> =>
            getOrSetCache(
                `fundamental:price-target-consensus:${sym(symbol)}`,
                TTL,
                () => this.inner.getPriceTargetConsensus(symbol)
            )
    );

    getPriceTargetSummary = cache(
        (symbol: string): Promise<FundamentalPriceTargetSummaryInput | null> =>
            getOrSetCache(
                `fundamental:price-target-summary:${sym(symbol)}`,
                TTL,
                () => this.inner.getPriceTargetSummary(symbol)
            )
    );

    // --- Task 3에서 추가: getStockPeers ---
    // --- Task 4에서 추가: getSectorPerformanceSnapshot + pass-through ---
    getStockPeers = (symbol: string): Promise<FundamentalPeerInput[]> =>
        this.inner.getStockPeers(symbol);

    getSectorPerformanceSnapshot = (
        date: string
    ): Promise<FundamentalSectorPerformanceInput[]> =>
        this.inner.getSectorPerformanceSnapshot(date);

    getHistoricalSectorPerformance = (
        sector: string
    ): Promise<FundamentalSectorHistoricalInput[]> =>
        this.inner.getHistoricalSectorPerformance(sector);

    getEarningsReport = (symbol: string): Promise<EarningsReport | null> =>
        this.inner.getEarningsReport(symbol);

    getEarningsReports = (
        symbol: string,
        limit?: number
    ): Promise<FmpEarningsReportItem[]> =>
        this.inner.getEarningsReports(symbol, limit);
}
```

> `getStockPeers`·`getSectorPerformanceSnapshot`는 Task 3·4에서 캐싱/enrich로 교체된다. 여기서는 컴파일을 위해 pass-through stub으로 둔다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`
Expected: PASS (단순 캐싱 메서드 5개 테스트).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/CachedFundamentalProvider.ts src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts
git commit -m "feat(fmp): add CachedFundamentalProvider with per-method Redis caching"
```

---

## Task 3: 데코레이터 `getStockPeers` — 캐싱 + per/psr enrich 통일

raw peer 목록은 `fundamental:peers:<SYM>`에 캐싱하고, 각 peer를 캐싱된 `getKeyMetricsTtm`으로 enrich한다. (분석 경로의 peer PER/PSR 누락 정상화.)

**Files:**
- Modify: `src/shared/api/fmp/CachedFundamentalProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`CachedFundamentalProvider.test.ts`에 describe 블록 추가:

```typescript
describe('CachedFundamentalProvider — getStockPeers enrich', () => {
    it('caches raw peers and enriches per/psr from getKeyMetricsTtm', async () => {
        const inner = makeInner({
            getStockPeers: vi.fn(async () => [
                { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2e12 },
                { symbol: 'GOOG', companyName: 'Alphabet', marketCap: 1.5e12 },
            ]),
            getKeyMetricsTtm: vi.fn(async (s: string) =>
                s === 'MSFT'
                    ? {
                          peRatioTTM: 30,
                          priceToSalesRatioTTM: 11,
                          pbRatioTTM: null,
                          pegRatioTTM: null,
                          enterpriseValueOverEBITDATTM: null,
                          epsTTM: null,
                      }
                    : null
            ),
        });
        const provider = new CachedFundamentalProvider(inner);

        const peers = await provider.getStockPeers('AAPL');

        expect(peers).toEqual([
            { symbol: 'MSFT', companyName: 'Microsoft', marketCap: 2e12, per: 30, psr: 11 },
            { symbol: 'GOOG', companyName: 'Alphabet', marketCap: 1.5e12, per: null, psr: null },
        ]);
        expect(store.has('fundamental:peers:AAPL')).toBe(true);
        // raw peer 목록 캐싱: 두 번째 호출 시 inner.getStockPeers 재호출 없음
        await provider.getStockPeers('AAPL');
        expect(inner.getStockPeers).toHaveBeenCalledTimes(1);
    });

    it('returns empty array for a symbol with no peers (worst case)', async () => {
        const inner = makeInner({ getStockPeers: vi.fn(async () => []) });
        const provider = new CachedFundamentalProvider(inner);
        expect(await provider.getStockPeers('NONE')).toEqual([]);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts -t "getStockPeers"`
Expected: FAIL — 현재 stub은 per/psr 없이 raw를 그대로 반환.

- [ ] **Step 3: `getStockPeers` 구현**

`CachedFundamentalProvider.ts`의 `getStockPeers` pass-through stub을 다음으로 교체:

```typescript
    /**
     * raw peer 목록을 `fundamental:peers:<SYM>`에 캐싱한 뒤, 각 peer를 캐싱된
     * `getKeyMetricsTtm`으로 enrich해 per/psr을 채운다. 페이지·분석이 동일한
     * enrich된 peer를 받아 core 프롬프트의 PER/PSR이 정상 채워진다.
     *
     * enrich는 콜드 캐시 시 peer당 동시 FMP 요청 폭증(rate-limit)을 피하려 순차
     * 실행한다 — warm 캐시에서는 getKeyMetricsTtm 히트로 비용이 낮다.
     */
    getStockPeers = cache(
        async (symbol: string): Promise<FundamentalPeerInput[]> => {
            const peers = await getOrSetCache(
                `fundamental:peers:${sym(symbol)}`,
                TTL,
                () => this.inner.getStockPeers(symbol)
            );
            const enriched: FundamentalPeerInput[] = [];
            for (const peer of peers) {
                const metrics = await this.getKeyMetricsTtm(peer.symbol);
                enriched.push({
                    ...peer,
                    per: metrics?.peRatioTTM ?? null,
                    psr: metrics?.priceToSalesRatioTTM ?? null,
                });
            }
            return enriched;
        }
    );
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts -t "getStockPeers"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/CachedFundamentalProvider.ts src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts
git commit -m "feat(fmp): cache + enrich stock peers in decorator (fix analysis PER/PSR gap)"
```

---

## Task 4: 데코레이터 sector-performance 캐싱 + pass-through 검증

`getSectorPerformanceSnapshot`을 `fundamental:sector-performance:<DATE>` 키로 캐싱하고, earnings/historical pass-through(캐싱 안 함)를 테스트로 못 박는다.

**Files:**
- Modify: `src/shared/api/fmp/CachedFundamentalProvider.ts`
- Test: `src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

```typescript
describe('CachedFundamentalProvider — sector + pass-through', () => {
    it('caches sector performance under fundamental:sector-performance:<DATE>', async () => {
        const inner = makeInner({
            getSectorPerformanceSnapshot: vi.fn(async () => [
                { sector: 'Technology', changesPercentage: 1.2 },
            ]),
        });
        const provider = new CachedFundamentalProvider(inner);

        const out = await provider.getSectorPerformanceSnapshot('2026-06-04');
        expect(out).toEqual([{ sector: 'Technology', changesPercentage: 1.2 }]);
        expect(store.has('fundamental:sector-performance:2026-06-04')).toBe(true);

        await provider.getSectorPerformanceSnapshot('2026-06-04');
        expect(inner.getSectorPerformanceSnapshot).toHaveBeenCalledTimes(1);
    });

    it('does NOT cache earnings (pass-through, fresh each call)', async () => {
        const inner = makeInner({
            getEarningsReports: vi.fn(async () => []),
            getEarningsReport: vi.fn(async () => null),
        });
        const provider = new CachedFundamentalProvider(inner);

        await provider.getEarningsReports('AAPL', 5);
        await provider.getEarningsReports('AAPL', 5);
        await provider.getEarningsReport('AAPL');
        await provider.getEarningsReport('AAPL');

        expect(inner.getEarningsReports).toHaveBeenCalledTimes(2);
        expect(inner.getEarningsReport).toHaveBeenCalledTimes(2);
        expect(store.size).toBe(0);
    });

    it('passes through historical sector performance without caching', async () => {
        const inner = makeInner();
        const provider = new CachedFundamentalProvider(inner);
        expect(await provider.getHistoricalSectorPerformance('Technology')).toEqual([]);
        expect(store.size).toBe(0);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts -t "sector"`
Expected: FAIL — sector pass-through stub은 캐싱하지 않아 `store.has(...)`가 false.

- [ ] **Step 3: `getSectorPerformanceSnapshot` 캐싱 구현**

`CachedFundamentalProvider.ts`의 `getSectorPerformanceSnapshot` stub을 교체:

```typescript
    /**
     * 섹터 스냅샷은 날짜 단위 데이터이므로 키를 `<DATE>`로 잡는다(심볼 무관).
     * 분석 경로에서만 호출되며 기존엔 무캐시였다 — 캐싱으로 분석마다의 FMP 호출을 막는다.
     */
    getSectorPerformanceSnapshot = cache(
        (date: string): Promise<FundamentalSectorPerformanceInput[]> =>
            getOrSetCache(`fundamental:sector-performance:${date}`, TTL, () =>
                this.inner.getSectorPerformanceSnapshot(date)
            )
    );
```

(earnings/historical pass-through 메서드는 Task 2에서 이미 stub으로 구현됨 — 변경 없음.)

- [ ] **Step 4: 전체 데코레이터 테스트 통과 확인**

Run: `yarn test src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts`
Expected: PASS (전체).

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/CachedFundamentalProvider.ts src/shared/api/fmp/__tests__/CachedFundamentalProvider.test.ts
git commit -m "feat(fmp): cache sector-performance snapshot, pass through earnings"
```

---

## Task 5: 팩토리에서 데코레이터 반환

`getFundamentalDataProvider()`가 prod에서 raw client를 데코레이터로 감싸 반환한다. E2E Fake는 그대로(캐싱 미적용).

**Files:**
- Modify: `src/shared/api/fmp/getFundamentalDataProvider.ts`
- Test: `src/shared/api/fmp/__tests__/getFundamentalDataProvider.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/shared/api/fmp/__tests__/getFundamentalDataProvider.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

afterEach(() => {
    vi.resetModules();
});

describe('getFundamentalDataProvider (prod)', () => {
    it('returns a CachedFundamentalProvider instance in prod', async () => {
        const { getFundamentalDataProvider } = await import(
            '@/shared/api/fmp/getFundamentalDataProvider'
        );
        const { CachedFundamentalProvider } = await import(
            '@/shared/api/fmp/CachedFundamentalProvider'
        );
        expect(getFundamentalDataProvider()).toBeInstanceOf(CachedFundamentalProvider);
    });

    it('returns the same singleton across calls', async () => {
        const { getFundamentalDataProvider } = await import(
            '@/shared/api/fmp/getFundamentalDataProvider'
        );
        expect(getFundamentalDataProvider()).toBe(getFundamentalDataProvider());
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `yarn test src/shared/api/fmp/__tests__/getFundamentalDataProvider.test.ts`
Expected: FAIL — 현재 prod는 `FmpFundamentalClient`를 반환.

- [ ] **Step 3: 팩토리 수정**

`src/shared/api/fmp/getFundamentalDataProvider.ts`의 import와 prod 분기 수정:

```typescript
import { CachedFundamentalProvider } from './CachedFundamentalProvider';
```

`getFundamentalDataProvider`의 마지막 두 줄(현 :37-38)을 교체:

```typescript
    cached = new CachedFundamentalProvider(new FmpFundamentalClient());
    return cached;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `yarn test src/shared/api/fmp/__tests__/getFundamentalDataProvider.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/fmp/getFundamentalDataProvider.ts src/shared/api/fmp/__tests__/getFundamentalDataProvider.test.ts
git commit -m "feat(fmp): wrap fundamental provider with cache decorator in factory"
```

---

## Task 6: `fundamentalData.ts` 정리 — 중복 캐싱·enrich 제거

데코레이터가 캐싱·enrich를 담당하므로, 페이지 데이터 파일의 `getOrSetCache` 래핑과 enrich 루프를 제거하고 provider 메서드 위임으로 축소한다. `getProfileDescriptionKo`의 DB 번역 로직은 유지.

**Files:**
- Modify: `src/app/[symbol]/fundamental/fundamentalData.ts`
- Test: 기존 `fundamentalData` 관련 테스트가 있으면 갱신(없으면 Task 5/2~4 커버리지로 충분 — 신규 테스트 생략).

- [ ] **Step 1: 파일 재작성**

`src/app/[symbol]/fundamental/fundamentalData.ts`를 다음으로 교체(상단 주석은 캐싱 이관 사실을 반영):

```typescript
import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import {
    DrizzleProfileDescriptionTranslationRepository,
    translateCompanyDescription,
} from '@/entities/ticker';
import { getFundamentalDataProvider } from '@/shared/api/fmp/getFundamentalDataProvider';
import type {
    FundamentalProfile,
    FundamentalPeerInput,
    FundamentalValuationMetrics,
    FundamentalRatiosInput,
    FundamentalGrowthInput,
    FundamentalFinancialScoresInput,
    FundamentalCashFlowInput,
    FundamentalAnalystEstimateInput,
    FundamentalGradesConsensusInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';

// Redis 캐싱(`fundamental:*` 키)·per/psr enrich는 CachedFundamentalProvider
// (getFundamentalDataProvider가 반환)로 이관됐다. 페이지·core 분석 경로가 동일
// provider를 통과해 같은 캐시를 공유한다. 이 파일은 provider 위임 + DB 번역
// (getProfileDescriptionKo)만 담당한다.
const fundamentalClient = getFundamentalDataProvider();

export const getProfile = (
    symbol: string
): Promise<FundamentalProfile | null> => fundamentalClient.getProfile(symbol);

export const getKeyMetricsTtm = (
    symbol: string
): Promise<FundamentalValuationMetrics | null> =>
    fundamentalClient.getKeyMetricsTtm(symbol);

export const getStockPeers = (
    symbol: string
): Promise<FundamentalPeerInput[]> => fundamentalClient.getStockPeers(symbol);

export const getRatiosTtm = (
    symbol: string
): Promise<FundamentalRatiosInput | null> =>
    fundamentalClient.getRatiosTtm(symbol);

export const getIncomeStatementGrowth = (
    symbol: string
): Promise<FundamentalGrowthInput | null> =>
    fundamentalClient.getIncomeStatementGrowth(symbol);

export const getFinancialScores = (
    symbol: string
): Promise<FundamentalFinancialScoresInput | null> =>
    fundamentalClient.getFinancialScores(symbol);

export const getCashFlowStatement = (
    symbol: string
): Promise<FundamentalCashFlowInput | null> =>
    fundamentalClient.getCashFlowStatement(symbol);

export const getAnalystEstimates = (
    symbol: string
): Promise<FundamentalAnalystEstimateInput | null> =>
    fundamentalClient.getAnalystEstimates(symbol);

export const getGradesConsensus = (
    symbol: string
): Promise<FundamentalGradesConsensusInput | null> =>
    fundamentalClient.getGradesConsensus(symbol);

export const getPriceTargetConsensus = (
    symbol: string
): Promise<FundamentalPriceTargetConsensusInput | null> =>
    fundamentalClient.getPriceTargetConsensus(symbol);

export const getPriceTargetSummary = (
    symbol: string
): Promise<FundamentalPriceTargetSummaryInput | null> =>
    fundamentalClient.getPriceTargetSummary(symbol);

/**
 * 회사 설명의 한국어 번역을 반환하고, 최초 호출 시 DB에 저장해 배포 간에도
 * 유지한다. Read: DB 조회(히트 시 즉시). Write: Gemini 번역 → DB upsert(심볼당 최초 1회).
 */
export const getProfileDescriptionKo = cache(
    async (symbol: string): Promise<string | null> => {
        const { db } = getDatabaseClient();
        const repo = new DrizzleProfileDescriptionTranslationRepository(db);

        const existing = await repo.findBySymbol(symbol);
        if (existing !== null) return existing.descriptionKo;

        const profile = await getProfile(symbol);
        if (profile === null || profile.description === null) return null;

        const translated = await translateCompanyDescription(profile.description);
        if (translated === null) return null;

        await repo.upsert({ symbol, descriptionKo: translated });
        return translated;
    }
);
```

> per-request dedup은 이제 데코레이터의 `cache()`가 담당하므로 이 파일의 export는 얇은 위임으로 충분하다. `getProfileDescriptionKo`만 자체 DB 로직이 있어 `cache()`를 유지한다.

- [ ] **Step 2: 타입체크/테스트**

Run: `yarn test src/app/[symbol]/fundamental/` (관련 테스트 있으면) 및 `yarn lint src/app/[symbol]/fundamental/fundamentalData.ts`
Expected: PASS / lint 통과. (호출부 page.tsx의 시그니처는 동일하므로 변경 불필요.)

- [ ] **Step 3: Commit**

```bash
git add src/app/[symbol]/fundamental/fundamentalData.ts
git commit -m "refactor(fundamental): delegate caching/enrich to CachedFundamentalProvider"
```

---

## Task 7: `newsData.ts` 정리 — grades 중복 캐싱 제거

`getGradeEvents`의 `getOrSetCache` 래핑을 제거하고 `provider.getGrades`(데코레이터 캐싱)에 위임한다. 페이지·뉴스가 동일 `fundamental:grades:*` 키를 공유한다.

**Files:**
- Modify: `src/app/[symbol]/news/newsData.ts`

- [ ] **Step 1: import·getGradeEvents 수정**

`src/app/[symbol]/news/newsData.ts`에서 `getOrSetCache` import와 `FMP_FUNDAMENTAL_REVALIDATE_SECONDS` import를 제거(다른 곳에서 안 쓰면). `getGradeEvents`(현 :39-46)를 교체:

```typescript
// 애널리스트 등급 이벤트는 CachedFundamentalProvider가 `fundamental:grades:*` 키로
// 캐싱한다(페이지 fundamental 경로와 동일 키 공유). 빈 배열도 캐싱된다 — getGrades는
// FMP 장애 시 throw하므로 빈 배열은 "등급 이벤트 없음"이라는 정상·안정 결과다.
export const getGradeEvents = (symbol: string): Promise<GradesEvent[]> =>
    fundamentalClient.getGrades(symbol);
```

import 정리:
- 제거: `import { getOrSetCache } from '@/shared/cache/getOrSetCache';`
- `FMP_FUNDAMENTAL_REVALIDATE_SECONDS`는 이 파일에서 더 이상 안 쓰이면 import에서 제거. (다른 사용처 확인: `EARNINGS_REPORT_STALE_MS` 등은 별개이므로 영향 없음.)
- `import { cache } from 'react';`는 `getNewsList`가 계속 사용하므로 유지.

- [ ] **Step 2: 타입체크/lint**

Run: `yarn lint src/app/[symbol]/news/newsData.ts`
Expected: 통과 (미사용 import 없음).

- [ ] **Step 3: Commit**

```bash
git add src/app/[symbol]/news/newsData.ts
git commit -m "refactor(news): delegate grades caching to CachedFundamentalProvider"
```

---

## Task 8: 전체 검증 — 커버리지·빌드·lint·기존 테스트

**Files:** 없음 (검증만)

- [ ] **Step 1: 신규 파일 커버리지 확인 (≥90%)**

Run: `yarn test-coverage src/shared/api/fmp/`
Expected: `CachedFundamentalProvider.ts`, `fundamentalClient.ts`(valuation 부분) 라인/브랜치 커버리지 90% 이상. 미달 시 부족한 브랜치(예: enrich에서 metrics null, fallback 분기)를 커버하는 테스트를 추가한다.

- [ ] **Step 2: 전체 테스트 스위트**

Run: `yarn test`
Expected: PASS (기존 테스트 회귀 없음).

- [ ] **Step 3: Lint / 타입 / 빌드**

Run: `yarn lint && yarn build`
Expected: 통과. (`yarn build`는 exit code를 직접 확인 — `> /tmp/build.log 2>&1; echo $?`.)

- [ ] **Step 4: 최종 커밋(필요 시)**

커버리지 보강 테스트를 추가했다면:

```bash
git add -A
git commit -m "test(fmp): raise CachedFundamentalProvider coverage to >=90%"
```

---

## Self-Review 결과

- **Spec 커버리지**: ① 분석 경로 Redis 우회 제거 → Task 5(팩토리 데코레이터). ② km/r 이중 fetch 제거 → Task 1. ③ peer PER/PSR enrich 통일 → Task 3. ④ 키/TTL 일관성 → Task 2~4(기존 `fundamental:*` 키). ⑤ sector-performance 신규 캐싱 → Task 4. ⑥ earnings/historical pass-through → Task 4. ⑦ 호출부 정리 → Task 6·7. 모든 spec 요구가 task에 매핑됨.
- **Placeholder 스캔**: 모든 코드 step에 실제 코드 포함. "적절히 처리" 류 없음.
- **타입 일관성**: `getValuationRaw` 반환 `{ metrics, ratios }`, 데코레이터 메서드 시그니처는 `FundamentalProvider` 포트와 일치. `FmpEarningsReportItem`은 `fundamentalClient`에서 import.
- **주의**: Task 2에서 `getStockPeers`/`getSectorPerformanceSnapshot`를 pass-through stub으로 먼저 두고 Task 3·4에서 캐싱 구현으로 교체한다(중간 단계도 컴파일 가능).

---

## 실행 후 (이 플랜 범위 밖, 사용자 지시)

구현·테스트 완료 후:
1. **review-agent를 Opus 4.8로 spawn**해 코드 리뷰 → findings 반영 → re-review 루프.
2. mistake-managing-agent → git-agent로 커밋/푸시/PR 생성.
3. **PR 리뷰 자동 반영 모니터**: claude-code-review Action을 60초 간격(최대 20분) 백그라운드 폴링. Changes Requested면 코멘트 전부 반영 후 Draft↔Ready 토글로 re-review. Approved면 Suggestion/Question까지 반영 후 모니터 종료(토글 없음). 병합은 일반 merge.
