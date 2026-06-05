import type { MockedFunction } from 'vitest';
import { getSectorSignalsAction } from '../actions/getSectorSignalsAction';
import { getCachedSectorSignals } from '../api/sectorSignalsCache';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';

vi.mock('server-only', () => ({}));

vi.mock('../api/sectorSignalsCache', () => ({
    getCachedSectorSignals: vi.fn(),
}));

const mockMarketProvider =
    {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockMarketProvider),
}));

const mockGetCachedSectorSignals = getCachedSectorSignals as MockedFunction<
    typeof getCachedSectorSignals
>;

const sectorResult: SectorSignalsResult = {
    computedAt: '2026-01-01T00:00:00Z',
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

describe('getSectorSignalsAction 함수는', () => {
    beforeEach(() => {
        mockGetCachedSectorSignals.mockReset();
    });

    it('timeframe 인자 없이 DEFAULT_DASHBOARD_TIMEFRAME(1Day)로 getCachedSectorSignals를 호출한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValueOnce(sectorResult);

        await getSectorSignalsAction();

        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            '1Day'
        );
    });

    it('timeframe 인자를 getCachedSectorSignals에 그대로 전달한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValueOnce(sectorResult);

        await getSectorSignalsAction('1Hour');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            '1Hour'
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValueOnce(sectorResult);

        const result = await getSectorSignalsAction('1Hour');

        expect(result).toBe(sectorResult);
    });

    it('에러 발생 시 빈 결과로 degrade한다', async () => {
        mockGetCachedSectorSignals.mockRejectedValueOnce(
            new Error('cache helper threw')
        );

        const result = await getSectorSignalsAction();
        expect(result.stocks).toEqual([]);
        expect(result.computedAt).toBeDefined();
    });
});
