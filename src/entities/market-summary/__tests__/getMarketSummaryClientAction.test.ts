import type { MockedFunction } from 'vitest';
import { getMarketSummaryClientAction } from '../actions/getMarketSummaryClientAction';
import { type MarketSummaryData } from '@y0ngha/siglens-core';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import {
    KR_DASHBOARD_SCOPE,
    US_DASHBOARD_SCOPE,
} from '@/shared/config/dashboardScope';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';

vi.mock('server-only', () => ({}));

vi.mock('../api/marketSummaryCache', () => ({
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
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => mockProvider),
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
            const result = await getMarketSummaryClientAction('us');

            expect(result).toEqual({ summary: summaryData, scope: 'us' });
        });

        it('(Happy) getCachedMarketSummary를 provider와 함께 호출한다', async () => {
            await getMarketSummaryClientAction('us');

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider,
                US_DASHBOARD_SCOPE
            );
        });
    });

    describe('E2E 모드에서는', () => {
        beforeEach(() => {
            mockIsE2E.mockReturnValue(true);
        });

        it('(Worst) force-partial 쿠키 없으면 summary를 그대로 반환한다', async () => {
            const result = await getMarketSummaryClientAction('us');

            expect(result).toEqual({ summary: summaryData, scope: 'us' });
        });

        it('(Worst) force-partial 쿠키가 있으면 첫 섹터 price를 0으로 만들어 반환한다', async () => {
            mockCookieGet.mockReturnValue({
                name: 'e2e_force_market_partial',
                value: '1',
            });

            const result = await getMarketSummaryClientAction('us');

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

            const result = await getMarketSummaryClientAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('scope 배선', () => {
        /**
         * 이 액션이 없으면 `/market/kr`은 SSR 시드만 KR이고 이후 클라 refetch가
         * 전부 미국 시세로 덮인다 — 게다가 그 값이 KR 쿼리 키에 캐시된다.
         */
        it("'kr'이면 KR 설정과 KR provider를 쓰고 응답에 scope를 실어 준다", async () => {
            vi.mocked(isE2E).mockReturnValue(false);
            vi.mocked(getCachedMarketSummary).mockResolvedValue(summaryData);

            const result = await getMarketSummaryClientAction('kr');

            expect(vi.mocked(marketDataProviderFor)).toHaveBeenCalledWith('kr');
            expect(getCachedMarketSummary).toHaveBeenCalledWith(
                expect.anything(),
                KR_DASHBOARD_SCOPE
            );
            expect(result).toEqual({ summary: summaryData, scope: 'kr' });
        });

        it('알 수 없는 scope는 캐시를 부르지 않고 server_error를 반환한다', async () => {
            const errSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            vi.mocked(getCachedMarketSummary).mockClear();

            const result = await getMarketSummaryClientAction('jp');

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(getCachedMarketSummary).not.toHaveBeenCalled();
            errSpy.mockRestore();
        });
    });
});
