import type { MockedFunction } from 'vitest';
import { getSectorSignalsAction } from '../actions/getSectorSignalsAction';
import { getCachedSectorSignals } from '../api/sectorSignalsCache';
import type { SectorSignalsResult } from '@y0ngha/siglens-core';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';

vi.mock('server-only', () => ({}));

vi.mock('../api/sectorSignalsCache', () => ({
    getCachedSectorSignals: vi.fn(),
}));

const mockMarketProvider =
    {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockMarketProvider),
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => mockMarketProvider),
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

        await getSectorSignalsAction('us');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            US_DASHBOARD_SCOPE,
            '1Day'
        );
    });

    it('timeframe 인자를 getCachedSectorSignals에 그대로 전달한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValueOnce(sectorResult);

        await getSectorSignalsAction('us', '1Hour');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            US_DASHBOARD_SCOPE,
            '1Hour'
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValueOnce(sectorResult);

        const result = await getSectorSignalsAction('us', '1Hour');

        expect(result).toBe(sectorResult);
    });

    it('에러 발생 시 빈 결과로 degrade한다', async () => {
        mockGetCachedSectorSignals.mockRejectedValueOnce(
            new Error('cache helper threw')
        );

        const result = await getSectorSignalsAction('us');
        expect(result.stocks).toEqual([]);
        expect(result.computedAt).toBeDefined();
    });

    it('kr scope는 KR 설정과 KR provider로 간다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sectorResult);

        await getSectorSignalsAction('kr', '1Hour');

        expect(vi.mocked(marketDataProviderFor)).toHaveBeenCalledWith('kr');
        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            KR_DASHBOARD_SCOPE,
            '1Hour'
        );
    });

    it('알 수 없는 scope는 캐시를 부르지 않고 빈 결과로 떨어진다', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await getSectorSignalsAction('jp');

        expect(result.stocks).toEqual([]);
        expect(mockGetCachedSectorSignals).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    /**
     * 롤링 배포 호환 shim — 옛 번들은 `('1Day')`처럼 timeframe 하나만 보낸다.
     * 이 분기가 없으면 배포 30분 동안 `/market`(트래픽 1위 페이지)의 신호 패널이
     * 통째로 빈다. shim이 있다는 것과, 그 shim이 미국 설정을 쓴다는 것을 함께 고정한다.
     */
    it('옛 번들의 단일 timeframe 인자 호출을 미국 설정으로 처리한다', async () => {
        mockGetCachedSectorSignals.mockResolvedValue(sectorResult);

        await getSectorSignalsAction('1Hour');

        expect(mockGetCachedSectorSignals).toHaveBeenCalledWith(
            mockMarketProvider,
            US_DASHBOARD_SCOPE,
            '1Hour'
        );
    });
});
