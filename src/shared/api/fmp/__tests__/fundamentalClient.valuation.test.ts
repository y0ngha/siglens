import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FmpFundamentalClient } from '@/shared/api/fmp/fundamentalClient';

const fmpGet = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/fmp/httpClient', () => ({
    fmpGet: (...args: unknown[]) => fmpGet(...args),
    FMP_STABLE_BASE: 'https://example.test/stable',
}));

describe('FmpFundamentalClient valuation fetch sharing', () => {
    beforeEach(() => {
        fmpGet.mockReset();
    });

    it('getKeyMetricsTtm + getRatiosTtm in same request fetch each endpoint once', async () => {
        fmpGet.mockImplementation((path: string) => {
            if (path === 'key-metrics-ttm')
                return Promise.resolve([
                    { peRatioTTM: 10, returnOnEquityTTM: 0.2 },
                ]);
            if (path === 'ratios-ttm')
                return Promise.resolve([
                    { priceToSalesRatioTTM: 3, netProfitMarginTTM: 0.15 },
                ]);
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

        const kmCalls = fmpGet.mock.calls.filter(
            c => c[0] === 'key-metrics-ttm'
        );
        const rCalls = fmpGet.mock.calls.filter(c => c[0] === 'ratios-ttm');
        expect(kmCalls).toHaveLength(1);
        expect(rCalls).toHaveLength(1);
    });

    it('sequential calls do not share in-flight (cross-request is Redis job)', async () => {
        fmpGet.mockImplementation((path: string) => {
            if (path === 'key-metrics-ttm')
                return Promise.resolve([{ peRatioTTM: 10 }]);
            if (path === 'ratios-ttm')
                return Promise.resolve([{ netProfitMarginTTM: 0.15 }]);
            return Promise.resolve([]);
        });
        const client = new FmpFundamentalClient();
        await client.getKeyMetricsTtm('AAPL'); // completes, clears in-flight
        await client.getRatiosTtm('AAPL'); // fresh fetch
        expect(
            fmpGet.mock.calls.filter(c => c[0] === 'key-metrics-ttm')
        ).toHaveLength(2);
    });

    it('returns null when both endpoints are empty (no throw on empty 200)', async () => {
        fmpGet.mockResolvedValue([]);
        const client = new FmpFundamentalClient();
        expect(await client.getKeyMetricsTtm('ZZZZ')).toBeNull();
        expect(await client.getRatiosTtm('ZZZZ')).toBeNull();
    });

    it('propagates (throws) FMP errors instead of swallowing to null (poison fix)', async () => {
        fmpGet.mockRejectedValue(new Error('FMP 503'));
        const client = new FmpFundamentalClient();
        await expect(client.getKeyMetricsTtm('AAPL')).rejects.toThrow(
            'FMP 503'
        );
        // 새 in-flight(finally로 제거됨)로 다시 fetch → 동일하게 throw
        await expect(client.getRatiosTtm('AAPL')).rejects.toThrow('FMP 503');
    });

    it('mixed-case concurrent calls share the same in-flight fetch (uppercase key coalesces)', async () => {
        fmpGet.mockImplementation((path: string) => {
            if (path === 'key-metrics-ttm')
                return Promise.resolve([{ peRatioTTM: 20 }]);
            if (path === 'ratios-ttm')
                return Promise.resolve([{ netProfitMarginTTM: 0.25 }]);
            return Promise.resolve([]);
        });

        const client = new FmpFundamentalClient();
        // 'aapl' and 'AAPL' must coalesce to a single in-flight entry
        const [km, ratios] = await Promise.all([
            client.getKeyMetricsTtm('aapl'),
            client.getRatiosTtm('AAPL'),
        ]);

        expect(km?.peRatioTTM).toBe(20);
        expect(ratios?.netProfitMarginTTM).toBe(0.25);

        // Each FMP endpoint must have been fetched exactly once despite the mixed
        // case — proving the uppercase key coalesced the two concurrent callers.
        expect(
            fmpGet.mock.calls.filter(c => c[0] === 'key-metrics-ttm')
        ).toHaveLength(1);
        expect(
            fmpGet.mock.calls.filter(c => c[0] === 'ratios-ttm')
        ).toHaveLength(1);
    });

    it('falls back to key-metrics fields when ratios endpoint is empty', async () => {
        fmpGet.mockImplementation((path: string) =>
            path === 'key-metrics-ttm'
                ? Promise.resolve([
                      { peRatioTTM: 12, pbRatioTTM: 2, returnOnEquityTTM: 0.3 },
                  ])
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
