import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CachedInvestorFlowsFmpProvider,
    INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS,
    INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT,
} from '../CachedInvestorFlowsFmpProvider';
import type { InvestorFlowsFmpProvider } from '../investorFlowsProvider.types';
import {
    INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS,
    INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS,
    SECONDS_PER_DAY,
    SECONDS_PER_HOUR,
} from '@/shared/config/time';

vi.mock('server-only', () => ({}));

const { store, fakeRedis } = vi.hoisted(() => {
    const store = new Map<string, unknown>();
    const fakeRedis = {
        get: vi.fn(async (key: string) =>
            store.has(key) ? store.get(key) : null
        ),
        set: vi.fn(
            async (key: string, value: unknown, _options?: { ex?: number }) => {
                store.set(key, value);
            }
        ),
    };
    return { store, fakeRedis };
});
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => fakeRedis,
}));

const FIXED_NOW = new Date('2026-10-15T12:00:00Z');

function makeInner(
    over: Partial<InvestorFlowsFmpProvider> = {}
): InvestorFlowsFmpProvider {
    return {
        getInsiderTrades: vi.fn(async () => [
            { filingDate: '2026-10-08' },
            { filingDate: '2026-04-20' },
        ]),
        getInsiderStatistics: vi.fn(async () => [{ year: 2026, quarter: 4 }]),
        getBeneficialOwnership: vi.fn(async () =>
            Array.from({ length: 50 }, (_, i) => ({
                filingDate: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
            }))
        ),
        getSharesFloat: vi.fn(async () => ({
            floatShares: 1,
            outstandingShares: 2,
        })),
        ...over,
    };
}

const ttlOf = (key: string): number | undefined =>
    fakeRedis.set.mock.calls.find(call => call[0] === key)?.[2]?.ex;

describe('CachedInvestorFlowsFmpProvider', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(FIXED_NOW);
        store.clear();
        fakeRedis.get.mockClear();
        fakeRedis.set.mockClear();
    });

    describe('keys and TTLs', () => {
        it('caches insider trades for 12h under investor-flows:insider:v1:<SYM>', async () => {
            await new CachedInvestorFlowsFmpProvider(
                makeInner()
            ).getInsiderTrades('aapl', 180);
            expect(ttlOf('investor-flows:insider:v1:AAPL')).toBe(
                INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS
            );
            expect(INVESTOR_FLOWS_INSIDER_CACHE_TTL_SECONDS).toBe(
                12 * SECONDS_PER_HOUR
            );
        });

        it('caches insider statistics for 12h', async () => {
            await new CachedInvestorFlowsFmpProvider(
                makeInner()
            ).getInsiderStatistics('aapl');
            expect(ttlOf('investor-flows:insider-stats:v1:AAPL')).toBe(
                12 * SECONDS_PER_HOUR
            );
        });

        it('caches 13D/G for 24h', async () => {
            await new CachedInvestorFlowsFmpProvider(
                makeInner()
            ).getBeneficialOwnership('aapl', 10);
            expect(ttlOf('investor-flows:13dg:v1:AAPL')).toBe(
                INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS
            );
            expect(INVESTOR_FLOWS_LARGE_HOLDER_CACHE_TTL_SECONDS).toBe(
                SECONDS_PER_DAY
            );
        });

        it('caches 13D/G for only 1h when the SEC form lookup failed for some row (so URL-guessed forms do not stick for a day)', async () => {
            const inner = makeInner({
                getBeneficialOwnership: vi.fn(async () => [
                    { filingDate: '2026-04-29', formLookupFailed: true },
                ]),
            });
            await new CachedInvestorFlowsFmpProvider(
                inner
            ).getBeneficialOwnership('aapl', 10);
            expect(ttlOf('investor-flows:13dg:v1:AAPL')).toBe(3600);
        });

        it('keeps the 24h TTL when every form was resolved', async () => {
            const inner = makeInner({
                getBeneficialOwnership: vi.fn(async () => [
                    { filingDate: '2026-04-29', form: 'SCHEDULE 13G/A' },
                ]),
            });
            await new CachedInvestorFlowsFmpProvider(
                inner
            ).getBeneficialOwnership('aapl', 10);
            expect(ttlOf('investor-flows:13dg:v1:AAPL')).toBe(SECONDS_PER_DAY);
        });

        it('caches shares float for 24h', async () => {
            await new CachedInvestorFlowsFmpProvider(
                makeInner()
            ).getSharesFloat('aapl');
            expect(ttlOf('investor-flows:float:v1:AAPL')).toBe(SECONDS_PER_DAY);
        });

        it('uses one key per symbol regardless of case', async () => {
            const inner = makeInner();
            const provider = new CachedInvestorFlowsFmpProvider(inner);
            await provider.getInsiderStatistics('aapl');
            await provider.getInsiderStatistics('AAPL');
            expect(inner.getInsiderStatistics).toHaveBeenCalledTimes(1);
        });
    });

    describe('cold fetch uses the widest window so one call cannot truncate another', () => {
        it('fetches insider trades with the fixed 12-month (365-day) lookback even when the caller asks for less', async () => {
            const inner = makeInner();
            await new CachedInvestorFlowsFmpProvider(inner).getInsiderTrades(
                'AAPL',
                30
            );
            expect(inner.getInsiderTrades).toHaveBeenCalledWith(
                'AAPL',
                INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS
            );
        });

        it('applies the caller’s narrower window only when reading', async () => {
            const provider = new CachedInvestorFlowsFmpProvider(makeInner());
            expect(await provider.getInsiderTrades('AAPL', 30)).toEqual([
                { filingDate: '2026-10-08' },
            ]);
            expect(await provider.getInsiderTrades('AAPL', 180)).toHaveLength(
                2
            );
        });

        it('fetches 13D/G with the fixed limit and slices on read', async () => {
            const inner = makeInner();
            const provider = new CachedInvestorFlowsFmpProvider(inner);
            expect(
                await provider.getBeneficialOwnership('AAPL', 3)
            ).toHaveLength(3);
            expect(inner.getBeneficialOwnership).toHaveBeenCalledWith(
                'AAPL',
                INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT
            );
            expect(
                await provider.getBeneficialOwnership('AAPL', 20)
            ).toHaveLength(20);
        });
    });

    describe('errors', () => {
        it('propagates an inner failure (throw = infrastructure failure) and caches nothing', async () => {
            const inner = makeInner({
                getInsiderStatistics: vi.fn(async () => {
                    throw new Error('FMP down');
                }),
            });
            await expect(
                new CachedInvestorFlowsFmpProvider(inner).getInsiderStatistics(
                    'AAPL'
                )
            ).rejects.toThrow('FMP down');
            expect(store.size).toBe(0);
        });

        it('caches a legitimate empty result so a quiet symbol does not re-hit FMP', async () => {
            const inner = makeInner({
                getBeneficialOwnership: vi.fn(async () => []),
            });
            const provider = new CachedInvestorFlowsFmpProvider(inner);
            await provider.getBeneficialOwnership('QUIET', 10);
            await provider.getBeneficialOwnership('QUIET', 10);
            expect(inner.getBeneficialOwnership).toHaveBeenCalledTimes(1);
        });

        it('caches a null shares-float result as well', async () => {
            const inner = makeInner({
                getSharesFloat: vi.fn(async () => null),
            });
            const provider = new CachedInvestorFlowsFmpProvider(inner);
            await provider.getSharesFloat('NOFLOAT');
            await provider.getSharesFloat('NOFLOAT');
            expect(inner.getSharesFloat).toHaveBeenCalledTimes(1);
        });
    });
});
