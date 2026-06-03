import { beforeEach, describe, expect, it, vi } from 'vitest';

// React.cache를 동기 메모이즈 stub으로 대체 — 비-RSC(vitest) 컨텍스트에서도
// same-request dedup을 검증하기 위함. 인스턴스별 격리는 각 it()에서 새 client로 보장.
vi.mock('react', async importOriginal => {
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

    it('returns null when both endpoints are empty (worst case)', async () => {
        fmpGet.mockResolvedValue([]);
        const client = new FmpFundamentalClient();
        expect(await client.getKeyMetricsTtm('ZZZZ')).toBeNull();
        expect(await client.getRatiosTtm('ZZZZ')).toBeNull();
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
