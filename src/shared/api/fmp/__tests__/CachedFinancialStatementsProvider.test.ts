import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CachedFinancialStatementsProvider } from '@/shared/api/fmp/CachedFinancialStatementsProvider';
import type { FinancialStatementsProvider } from '@y0ngha/siglens-core';
import { FMP_STATEMENTS_REVALIDATE_SECONDS } from '@/shared/config/time';

// In-memory fake Redis mirroring the pattern in CachedFundamentalProvider.test.ts.
// NOTE: react cache is a pass-through in vitest — second calls re-enter
// getOrSetCache, so fake-Redis hit logic is exercised.
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

function resetSharedState() {
    store.clear();
    redisEnabled = true;
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
}

function makeInner(
    overrides: Partial<FinancialStatementsProvider> = {}
): FinancialStatementsProvider {
    return {
        getIncomeStatements: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                date: '2024-09-28',
                revenue: 391_035_000_000,
                grossProfit: 170_782_000_000,
                operatingIncome: 123_216_000_000,
                netIncome: 93_736_000_000,
                ebitda: 134_000_000_000,
                eps: 6.11,
                epsDiluted: 6.08,
                grossMargin: null,
                operatingMargin: null,
                netMargin: null,
            },
        ]),
        getBalanceSheets: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                date: '2024-09-28',
                totalAssets: 364_980_000_000,
                totalCurrentAssets: 152_987_000_000,
                totalLiabilities: 308_030_000_000,
                totalCurrentLiabilities: 176_392_000_000,
                cashAndShortTermInvestments: 65_171_000_000,
                totalDebt: 101_304_000_000,
                netDebt: 47_476_000_000,
                totalStockholdersEquity: 56_950_000_000,
                currentRatio: null,
            },
        ]),
        getCashFlowStatements: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                date: '2024-09-28',
                operatingCashFlow: 118_254_000_000,
                capitalExpenditure: -9_447_000_000,
                freeCashFlow: 108_807_000_000,
                dividendsPaid: -15_234_000_000,
                fcfMargin: null,
            },
        ]),
        getIncomeStatementGrowths: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                growthRevenue: 0.02,
                growthNetIncome: 0.07,
                growthEPS: 0.11,
                growthOperatingIncome: 0.1,
            },
        ]),
        getFinancialGrowths: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                revenueGrowth: 0.02,
                netIncomeGrowth: 0.07,
                epsGrowth: 0.11,
                freeCashFlowGrowth: 0.15,
                operatingCashFlowGrowth: 0.09,
                assetGrowth: 0.03,
                debtGrowth: -0.05,
                threeYRevenueGrowthPerShare: 0.08,
                fiveYRevenueGrowthPerShare: 0.12,
                tenYRevenueGrowthPerShare: 0.1,
            },
        ]),
        getCashFlowGrowths: vi.fn(async () => [
            {
                fiscalYear: '2024',
                period: 'FY',
                growthOperatingCashFlow: 0.07,
                growthFreeCashFlow: 0.09,
                growthCapitalExpenditure: -0.02,
            },
        ]),
        ...overrides,
    } as FinancialStatementsProvider;
}

describe('CachedFinancialStatementsProvider — cache key format & TTL', () => {
    beforeEach(resetSharedState);

    it('caches getIncomeStatements under financials:income:<SYM>:<period> with correct TTL', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getIncomeStatements('aapl', 'annual', 5);

        expect(store.has('financials:income:AAPL:annual')).toBe(true);
        // TTL is passed as the second arg to redis.set — check the ex option
        const setCall = fakeRedis.set.mock.calls[0];
        expect(setCall![0]).toBe('financials:income:AAPL:annual');
        // The getOrSetCache wrapper stores as { data: value }
        expect((setCall![2] as { ex?: number }).ex).toBe(
            FMP_STATEMENTS_REVALIDATE_SECONDS
        );
    });

    it('uppercases the symbol for the cache key', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getIncomeStatements('aapl', 'annual', 5);
        expect(store.has('financials:income:AAPL:annual')).toBe(true);
        expect(store.has('financials:income:aapl:annual')).toBe(false);
    });

    it('caches getBalanceSheets under financials:balance:<SYM>:<period>', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getBalanceSheets('MSFT', 'annual', 5);
        expect(store.has('financials:balance:MSFT:annual')).toBe(true);
    });

    it('caches getCashFlowStatements under financials:cashflow:<SYM>:<period>', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getCashFlowStatements('GOOG', 'quarter', 5);
        expect(store.has('financials:cashflow:GOOG:quarter')).toBe(true);
    });

    it('caches getIncomeStatementGrowths under financials:income-growth:<SYM>:<period>', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getIncomeStatementGrowths('TSLA', 'annual', 5);
        expect(store.has('financials:income-growth:TSLA:annual')).toBe(true);
    });

    it('caches getFinancialGrowths under financials:financial-growth:<SYM>:<period>', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getFinancialGrowths('NVDA', 'annual', 5);
        expect(store.has('financials:financial-growth:NVDA:annual')).toBe(true);
    });

    it('caches getCashFlowGrowths under financials:cashflow-growth:<SYM>:<period>', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getCashFlowGrowths('META', 'annual', 5);
        expect(store.has('financials:cashflow-growth:META:annual')).toBe(true);
    });

    it('keys are period-scoped: annual and quarter cache separately', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getIncomeStatements('AAPL', 'annual', 5);
        await provider.getIncomeStatements('AAPL', 'quarter', 4);

        expect(store.has('financials:income:AAPL:annual')).toBe(true);
        expect(store.has('financials:income:AAPL:quarter')).toBe(true);
        expect(inner.getIncomeStatements).toHaveBeenCalledTimes(2);
    });
});

describe('CachedFinancialStatementsProvider — cache hit avoids inner call', () => {
    beforeEach(resetSharedState);

    it('second call for same symbol+period hits Redis, skips inner', async () => {
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        await provider.getIncomeStatements('AAPL', 'annual', 5);
        expect(inner.getIncomeStatements).toHaveBeenCalledTimes(1);

        await provider.getIncomeStatements('AAPL', 'annual', 5);
        expect(inner.getIncomeStatements).toHaveBeenCalledTimes(1);
    });

    it('caches [] (empty) so rollforward/longTail tickers are not refetched', async () => {
        const inner = makeInner({
            getIncomeStatements: vi.fn(async () => []),
        });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(await provider.getIncomeStatements('X', 'annual', 5)).toEqual(
            []
        );
        expect(await provider.getIncomeStatements('X', 'annual', 5)).toEqual(
            []
        );
        expect(inner.getIncomeStatements).toHaveBeenCalledTimes(1);
    });
});

describe('CachedFinancialStatementsProvider — graceful [] on inner throw (no poison)', () => {
    beforeEach(resetSharedState);

    it('getIncomeStatements: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getIncomeStatements: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(await provider.getIncomeStatements('ERR', 'annual', 5)).toEqual(
            []
        );
        // Failure must not be cached in Redis — a fresh provider can retry
        expect(store.has('financials:income:ERR:annual')).toBe(false);
        // A new provider instance (new React.cache scope) must also call inner
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(await provider2.getIncomeStatements('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getBalanceSheets: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 502');
        });
        const inner = makeInner({ getBalanceSheets: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(await provider.getBalanceSheets('ERR', 'annual', 5)).toEqual([]);
        expect(store.has('financials:balance:ERR:annual')).toBe(false);
        // New provider instance → inner must be called again (not served from Redis)
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(await provider2.getBalanceSheets('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getCashFlowStatements: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 500');
        });
        const inner = makeInner({ getCashFlowStatements: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(
            await provider.getCashFlowStatements('ERR', 'annual', 5)
        ).toEqual([]);
        expect(store.has('financials:cashflow:ERR:annual')).toBe(false);
        // New provider instance → inner must be called again (not served from Redis)
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(
            await provider2.getCashFlowStatements('ERR', 'annual', 5)
        ).toEqual([]);
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getIncomeStatementGrowths: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 429');
        });
        const inner = makeInner({ getIncomeStatementGrowths: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(
            await provider.getIncomeStatementGrowths('ERR', 'annual', 5)
        ).toEqual([]);
        expect(store.has('financials:income-growth:ERR:annual')).toBe(false);
        // New provider instance → inner must be called again (not served from Redis)
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(
            await provider2.getIncomeStatementGrowths('ERR', 'annual', 5)
        ).toEqual([]);
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getFinancialGrowths: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getFinancialGrowths: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(await provider.getFinancialGrowths('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(store.has('financials:financial-growth:ERR:annual')).toBe(false);
        // New provider instance → inner must be called again (not served from Redis)
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(await provider2.getFinancialGrowths('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });

    it('getCashFlowGrowths: inner throw → returns [], does NOT cache failure', async () => {
        const boom = vi.fn(async () => {
            throw new Error('FMP 503');
        });
        const inner = makeInner({ getCashFlowGrowths: boom });
        const provider = new CachedFinancialStatementsProvider(inner);

        expect(await provider.getCashFlowGrowths('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(store.has('financials:cashflow-growth:ERR:annual')).toBe(false);
        // New provider instance → inner must be called again (not served from Redis)
        const provider2 = new CachedFinancialStatementsProvider(inner);
        expect(await provider2.getCashFlowGrowths('ERR', 'annual', 5)).toEqual(
            []
        );
        expect(boom).toHaveBeenCalledTimes(2);
    });
});

describe('CachedFinancialStatementsProvider — Redis unavailable fallback', () => {
    beforeEach(resetSharedState);

    it('falls back to inner when Redis is disabled', async () => {
        redisEnabled = false;
        const inner = makeInner();
        const provider = new CachedFinancialStatementsProvider(inner);

        const rows = await provider.getIncomeStatements('AAPL', 'annual', 5);
        expect(rows).toHaveLength(1);
        expect(inner.getIncomeStatements).toHaveBeenCalledTimes(1);
        expect(store.size).toBe(0);
    });
});
