import type { MockedFunction } from 'vitest';
import { submitMarketBriefingAction } from '../actions/submitMarketBriefingAction';
import {
    submitBriefing,
    type MarketSummaryData,
    type SubmitBriefingResult,
} from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

vi.mock('server-only', () => ({}));

vi.mock('../lib/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitBriefing: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/shared/api/isBot', () => ({
    isBot: vi.fn(),
}));

const mockProvider = {} as import('@y0ngha/siglens-core').MarketDataProvider;
vi.mock('@/shared/api/market/getMarketDataProvider', () => ({
    getMarketDataProvider: vi.fn(() => mockProvider),
}));

const mockGetCachedMarketSummary = getCachedMarketSummary as MockedFunction<
    typeof getCachedMarketSummary
>;
const mockSubmitBriefing = submitBriefing as MockedFunction<
    typeof submitBriefing
>;
const mockIsBot = isBot as MockedFunction<typeof isBot>;

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

const briefingResult: SubmitBriefingResult = {
    status: 'submitted',
    jobId: 'test-job-id',
};

describe('submitMarketBriefingAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCachedMarketSummary.mockResolvedValue(summaryData);
    });

    describe('비봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(false);
            mockSubmitBriefing.mockResolvedValue(briefingResult);
        });

        it('(Happy) submitBriefing 결과와 botBlocked: false를 반환한다', async () => {
            const result = await submitMarketBriefingAction();

            expect(result).toEqual({
                briefing: briefingResult,
                botBlocked: false,
            });
        });

        it('(Happy) getCachedMarketSummary와 submitBriefing(summary)를 호출한다', async () => {
            await submitMarketBriefingAction();

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider
            );
            expect(mockSubmitBriefing).toHaveBeenCalledWith(summaryData);
        });
    });

    describe('봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(true);
        });

        it('(Worst) briefing: null과 botBlocked: true를 반환한다', async () => {
            const result = await submitMarketBriefingAction();

            expect(result).toEqual({ briefing: null, botBlocked: true });
        });

        it('(Worst) submitBriefing을 호출하지 않는다', async () => {
            await submitMarketBriefingAction();

            expect(mockSubmitBriefing).not.toHaveBeenCalled();
        });
    });

    describe('에러 발생 시', () => {
        it('(Worst) submitBriefing이 throw하면 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockSubmitBriefing.mockRejectedValueOnce(
                new Error('briefing failed')
            );

            const result = await submitMarketBriefingAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });

        it('(Worst) getCachedMarketSummary throw 시 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('redis down')
            );

            const result = await submitMarketBriefingAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
