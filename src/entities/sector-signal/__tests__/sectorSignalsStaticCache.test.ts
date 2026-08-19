import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
    unstable_cache: (
        fn: (timeframe: string) => Promise<SectorSignalsResult>,
        keys: unknown,
        opts: unknown
    ) => {
        (globalThis as Record<string, unknown>).__lastUnstableCacheKeys = keys;
        (globalThis as Record<string, unknown>).__lastUnstableCacheOpts = opts;
        return fn;
    },
}));

vi.mock('../api/sectorSignalsCache', () => ({
    getCachedSectorSignals: vi.fn(),
    sectorStocksConfigFingerprint: vi.fn(() => 'abcdef012345'),
}));

vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => ({})),
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => ({})),
}));

import { getSectorSignalsStatic } from '../api/sectorSignalsStaticCache';
import { getCachedSectorSignals } from '../api/sectorSignalsCache';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';

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
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheKeys;
        delete (globalThis as Record<string, unknown>).__lastUnstableCacheOpts;
    });

    it('(Happy) getCachedSectorSignals를 timeframe과 함께 호출하고 결과를 반환한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        const result = await getSectorSignalsStatic(US_DASHBOARD_SCOPE, '1Day');

        expect(result).toBe(sampleResult);
        expect(mockGetCachedSectorSignals).toHaveBeenCalledTimes(1);
    });

    it('(Happy) unstable_cache opts: revalidate=3600, tags=[sector:signals:us]', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic(US_DASHBOARD_SCOPE, '1Hour');

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['sector:signals:us'],
        });
    });

    it('(Happy) static cache key에 sectorStocks 설정 fingerprint를 포함한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic(US_DASHBOARD_SCOPE, '1Day');

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheKeys
        ).toEqual([
            'sector-signals-static',
            'us',
            '1Day',
            expect.stringMatching(/^[a-f0-9]{12}$/),
        ]);
    });

    it('(Happy) 서로 다른 timeframe은 독립적으로 호출된다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic(US_DASHBOARD_SCOPE, '1Day');
        await getSectorSignalsStatic(US_DASHBOARD_SCOPE, '15Min');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledTimes(2);
    });

    /**
     * scope별로 키·태그가 갈리지 않으면 `/market/kr` 신호 스캐너가 미국 종목을
     * 조용히 그린다 — 렌더도 숫자도 멀쩡해 보이는 종류의 회귀다.
     */
    it('(Happy) kr scope는 미국과 다른 캐시 키·태그를 쓰고 provider도 kr로 고른다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sampleResult);

        await getSectorSignalsStatic(KR_DASHBOARD_SCOPE, '1Day');

        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheKeys
        ).toEqual([
            'sector-signals-static',
            'kr',
            '1Day',
            expect.stringMatching(/^[a-f0-9]{12}$/),
        ]);
        expect(
            (globalThis as Record<string, unknown>).__lastUnstableCacheOpts
        ).toEqual({
            revalidate: SECONDS_PER_HOUR,
            tags: ['sector:signals:kr'],
        });
        expect(vi.mocked(marketDataProviderFor)).toHaveBeenCalledWith('kr');
        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            expect.anything(),
            KR_DASHBOARD_SCOPE,
            '1Day'
        );
    });

    it('(Worst) getCachedSectorSignals가 throw하면 에러가 전파된다', async () => {
        mockGetCachedSectorSignals.mockRejectedValue(
            new Error('signals failed')
        );

        await expect(
            getSectorSignalsStatic(US_DASHBOARD_SCOPE, '1Day')
        ).rejects.toThrow('signals failed');
    });
});
