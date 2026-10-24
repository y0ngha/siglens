import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { findCikBySymbol, fetchConcept, getOrSetCache, flagIsSet, flagMark } =
    vi.hoisted(() => ({
        flagIsSet: vi.fn(),
        flagMark: vi.fn(),
        findCikBySymbol: vi.fn(),
        fetchConcept: vi.fn(),
        getOrSetCache: vi.fn(),
    }));
vi.mock('@/shared/cache/createRedisFlag', () => ({
    createRedisFlag: () => ({ isSet: flagIsSet, mark: flagMark }),
}));
vi.mock('@/entities/investor-flows/api/investorFlowsFilingsRepository', () => ({
    DrizzleSecFilingsRepository: class {
        findCikBySymbol = findCikBySymbol;
    },
}));
vi.mock('@/shared/api/sec/secClient', () => ({
    fetchCompanyConceptJson: fetchConcept,
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));

import {
    loadSecQuarters,
    SEC_QUARTERS_BUDGET_MS,
} from '@/app/api/ai/chat/tools/loadSecQuarters';
import { FMP_FUNDAMENTAL_CACHE_TTL_SECONDS } from '@/shared/config/time';
import type { SiglensDatabase } from '@/shared/db/types';
import {
    ipRevenue,
    jbhtRevenueIncludingTax,
    jbhtRevenuesStale,
    tprEps,
    tprRevenue,
} from './fixtures/secConcepts';

const db = 'fake-db' as unknown as SiglensDatabase;

/** Concept bodies per CIK; any concept not listed is a 404 (`null`). */
function serve(bodies: Record<string, unknown>) {
    fetchConcept.mockImplementation(async (_cik: number, concept: string) =>
        concept in bodies ? bodies[concept] : null
    );
}

describe('loadSecQuarters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        flagIsSet.mockResolvedValue(false);
        flagMark.mockResolvedValue(undefined);
        // Cache miss: run the fetcher.
        getOrSetCache.mockImplementation(
            async (_key: string, _ttl: number, fetcher: () => unknown) =>
                fetcher()
        );
    });

    it('a symbol with no CIK (Korean, outside the universe) is null with no SEC request or cache access', async () => {
        findCikBySymbol.mockResolvedValue(null);
        expect(await loadSecQuarters('005930.KS', db)).toBeNull();
        expect(fetchConcept).not.toHaveBeenCalled();
        expect(getOrSetCache).not.toHaveBeenCalled();
    });

    it('caches the extracted rows per CIK for a day and requests EPS plus the four revenue tags', async () => {
        findCikBySymbol.mockResolvedValue(1116132);
        serve({
            EarningsPerShareDiluted: tprEps,
            RevenueFromContractWithCustomerExcludingAssessedTax: tprRevenue,
        });
        const rows = await loadSecQuarters('TPR', db);
        expect(getOrSetCache).toHaveBeenCalledWith(
            'sec:xbrl-quarters:v1:1116132',
            FMP_FUNDAMENTAL_CACHE_TTL_SECONDS,
            expect.any(Function)
        );
        expect(fetchConcept.mock.calls.map(c => c[1]).toSorted()).toEqual(
            [
                'EarningsPerShareDiluted',
                'Revenues',
                'RevenueFromContractWithCustomerExcludingAssessedTax',
                'RevenueFromContractWithCustomerIncludingAssessedTax',
                'SalesRevenueNet',
            ].toSorted()
        );
        expect(fetchConcept.mock.calls.every(c => c[0] === 1116132)).toBe(true);
        expect(rows?.find(q => q.periodEnd === '2026-03-28')).toMatchObject({
            epsDiluted: 1.65,
            form: '10-Q',
        });
    });

    it('the cached value is the extracted rows, not the raw JSON', async () => {
        findCikBySymbol.mockResolvedValue(51434);
        serve({
            RevenueFromContractWithCustomerExcludingAssessedTax: ipRevenue,
        });
        const rows = await loadSecQuarters('IP', db);
        expect(JSON.stringify(rows)).not.toContain('"units"');
        expect(rows?.[0]).toEqual({
            periodEnd: '2026-06-30',
            form: '10-Q',
            accn: '0000051434-26-000123',
            filed: '2026-08-05',
            epsDiluted: null,
            revenue: 6_004_000_000,
            revenueYoYPct: -2.25,
        });
    });

    it('picks the revenue tag with the newest filing, not a stale one that still answers', async () => {
        findCikBySymbol.mockResolvedValue(728535);
        serve({
            Revenues: jbhtRevenuesStale,
            RevenueFromContractWithCustomerIncludingAssessedTax:
                jbhtRevenueIncludingTax,
        });
        const rows = await loadSecQuarters('JBHT', db);
        expect(rows?.[0]).toMatchObject({
            periodEnd: '2026-09-30',
            revenue: 3_676_807_000,
        });
    });

    it('a filer with no 10-Q/10-K facts (all concepts 404) is an empty array, which is cached', async () => {
        findCikBySymbol.mockResolvedValue(1);
        serve({});
        expect(await loadSecQuarters('ADR', db)).toEqual([]);
        expect(getOrSetCache).toHaveBeenCalledTimes(1);
    });

    it('a failed SEC request rejects and leaves a failure marker for that CIK', async () => {
        findCikBySymbol.mockResolvedValue(1116132);
        fetchConcept.mockRejectedValue(new Error('SEC 503'));
        await expect(loadSecQuarters('TPR', db)).rejects.toThrow('SEC 503');
        expect(flagMark).toHaveBeenCalledWith(1116132);
    });

    it('while the failure marker is set the fetcher fails fast with no SEC request', async () => {
        findCikBySymbol.mockResolvedValue(1116132);
        flagIsSet.mockResolvedValue(true);
        await expect(loadSecQuarters('TPR', db)).rejects.toThrow(
            'recently failed'
        );
        expect(fetchConcept).not.toHaveBeenCalled();
        expect(flagMark).not.toHaveBeenCalled();
    });

    it('a cache hit is served even while the failure marker is set', async () => {
        findCikBySymbol.mockResolvedValue(1116132);
        flagIsSet.mockResolvedValue(true);
        getOrSetCache.mockResolvedValue([{ periodEnd: '2026-03-28' }]);
        expect(await loadSecQuarters('TPR', db)).toEqual([
            { periodEnd: '2026-03-28' },
        ]);
    });

    describe('budget', () => {
        afterEach(() => {
            vi.useRealTimers();
        });

        it('gives up after the budget when the SEC hangs, without marking a failure', async () => {
            vi.useFakeTimers();
            findCikBySymbol.mockResolvedValue(1116132);
            getOrSetCache.mockImplementation(() => new Promise(() => {}));
            const run = loadSecQuarters('TPR', db);
            const assertion = expect(run).rejects.toThrow('budget exceeded');
            await vi.advanceTimersByTimeAsync(SEC_QUARTERS_BUDGET_MS);
            await assertion;
            expect(flagMark).not.toHaveBeenCalled();
        });

        it('returns normally when the load finishes within the budget', async () => {
            vi.useFakeTimers();
            findCikBySymbol.mockResolvedValue(1);
            serve({});
            expect(await loadSecQuarters('X', db)).toEqual([]);
        });
    });

    it('a failed CIK lookup rejects', async () => {
        findCikBySymbol.mockRejectedValue(new Error('db down'));
        await expect(loadSecQuarters('TPR', db)).rejects.toThrow('db down');
        expect(fetchConcept).not.toHaveBeenCalled();
    });
});
