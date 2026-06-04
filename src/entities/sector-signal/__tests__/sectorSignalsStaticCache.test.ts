import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
    unstable_cache: (
        fn: (timeframe: string) => Promise<SectorSignalsResult>,
        _keys: unknown,
        opts: unknown
    ) => {
        (globalThis as Record<string, unknown>).__lastUnstableCacheOpts = opts;
        return fn;
    },
}));

vi.mock('../lib/sectorSignalsCache', () => ({
    getCachedSectorSignals: vi.fn(),
}));

vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => ({})),
}));

import { getSectorSignalsStatic } from '../lib/sectorSignalsStaticCache';
import { getCachedSectorSignals } from '../lib/sectorSignalsCache';

const mockGetCachedSectorSignals = vi.mocked(getCachedSectorSignals);

const sampleResult: SectorSignalsResult = {
    computedAt: '2026-06-04T00:00:00Z',
    stocks: [
        {
            symbol: 'AAPL',
            koreanName: '애플',
            sectorSymbol: 'XLK',
            price: 100,
            changePercent: 1.5,
            trend: 'uptrend',
            signals: [],
        },
    ],
};

describe('getSectorSignalsStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheOpts;
    });

    it('(Happy) getCachedSectorSignals를 timeframe과 함께 호출하고 결과를 반환한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        const result = await getSectorSignalsStatic('1Day');

        expect(result).toBe(sampleResult);
        expect(mockGetCachedSectorSignals).toHaveBeenCalledTimes(1);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[market-summary]', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic('1Hour');

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['market-summary'],
        });
    });

    it('(Happy) 서로 다른 timeframe은 독립적으로 호출된다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic('1Day');
        await getSectorSignalsStatic('15Min');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledTimes(2);
    });

    it('(Worst) getCachedSectorSignals가 throw하면 에러가 전파된다', async () => {
        mockGetCachedSectorSignals.mockRejectedValue(
            new Error('signals failed')
        );

        await expect(getSectorSignalsStatic('1Day')).rejects.toThrow(
            'signals failed'
        );
    });
});
