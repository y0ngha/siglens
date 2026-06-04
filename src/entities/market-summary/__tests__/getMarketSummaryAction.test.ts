import type { MockedFunction } from 'vitest';
import { getMarketSummaryClientAction } from '../actions/getMarketSummaryClientAction';
import { type MarketSummaryData } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

vi.mock('server-only', () => ({}));

vi.mock('../lib/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
}));

const { mockCookieGet } = vi.hoisted(() => ({ mockCookieGet: vi.fn() }));
vi.mock('next/headers', () => ({
    cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

vi.mock('@/shared/api/e2eEnv', () => ({
    isE2E: vi.fn(),
}));

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockProvider),
}));

const mockGetCachedMarketSummary = getCachedMarketSummary as MockedFunction<
    typeof getCachedMarketSummary
>;
const mockIsE2E = isE2E as MockedFunction<typeof isE2E>;

const summaryData: MarketSummaryData = {
    indices: [
        {
            symbol: 'SPY',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: 'S&P 500',
            price: 5000,
            changesPercentage: 0.5,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 200,
            changesPercentage: 1.2,
        },
    ],
};

describe('getMarketSummaryClientAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCachedMarketSummary.mockResolvedValue(summaryData);
        mockIsE2E.mockReturnValue(false);
        mockCookieGet.mockReturnValue(undefined);
    });

    describe('일반(비-E2E) 요청 시', () => {
        it('(Happy) summary를 그대로 반환한다', async () => {
            const result = await getMarketSummaryClientAction();

            expect(result).toEqual({ summary: summaryData });
        });

        it('(Happy) getCachedMarketSummary를 provider와 함께 호출한다', async () => {
            await getMarketSummaryClientAction();

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider
            );
        });
    });

    describe('E2E 모드에서는', () => {
        beforeEach(() => {
            mockIsE2E.mockReturnValue(true);
        });

        it('(Worst) force-partial 쿠키 없으면 summary를 그대로 반환한다', async () => {
            const result = await getMarketSummaryClientAction();

            expect(result).toEqual({ summary: summaryData });
        });

        it('(Worst) force-partial 쿠키가 있으면 첫 섹터 price를 0으로 만들어 반환한다', async () => {
            mockCookieGet.mockReturnValue({
                name: 'e2e_force_market_partial',
                value: '1',
            });

            const result = await getMarketSummaryClientAction();

            expect('ok' in result).toBe(false);
            if ('ok' in result) return;
            // 지수는 그대로, 첫 섹터만 price/change가 0으로 강제된다.
            expect(result.summary.indices).toEqual(summaryData.indices);
            expect(result.summary.sectors[0]).toMatchObject({
                symbol: 'XLK',
                price: 0,
                changesPercentage: 0,
            });
        });
    });

    describe('API 에러 발생 시', () => {
        it('(Worst) getCachedMarketSummary 예외 시 에러 결과를 반환한다', async () => {
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('network timeout')
            );

            const result = await getMarketSummaryClientAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
