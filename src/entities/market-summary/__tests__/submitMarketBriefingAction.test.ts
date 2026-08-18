import type { MockedFunction } from 'vitest';
import { submitMarketBriefingAction } from '../actions/submitMarketBriefingAction';
import {
    runBriefing,
    type MarketSummaryData,
    type RunBriefingResult,
} from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { getCachedMarketSummary } from '../api/marketSummaryCache';
import { US_DASHBOARD_SCOPE } from '@/shared/config/dashboardScope';

vi.mock('server-only', () => ({}));

vi.mock('../api/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    runBriefing: vi.fn(),
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
    // scope 인지 팩토리도 같은 모듈에 있다 — 목에서 빠지면 액션이 import 단계에서
    // 실패해 `server_error`로 조용히 떨어진다.
    marketDataProviderFor: vi.fn(() => mockProvider),
}));

const mockGetCachedMarketSummary = getCachedMarketSummary as MockedFunction<
    typeof getCachedMarketSummary
>;
const mockRunBriefing = runBriefing as MockedFunction<typeof runBriefing>;
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

const briefingResult: RunBriefingResult = {
    status: 'done',
    briefing: { summary: 'test-briefing' } as never,
    generatedAt: '2025-01-01T00:00:00Z',
};

describe('submitMarketBriefingAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCachedMarketSummary.mockResolvedValue(summaryData);
    });

    describe('비봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(false);
            mockRunBriefing.mockResolvedValue(briefingResult);
        });

        it('(Happy) runBriefing 결과와 botBlocked: false를 반환한다', async () => {
            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({
                briefing: briefingResult,
                botBlocked: false,
            });
        });

        it('(Happy) getCachedMarketSummary와 runBriefing(summary)를 호출한다', async () => {
            await submitMarketBriefingAction('us');

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider,
                US_DASHBOARD_SCOPE
            );
            expect(mockRunBriefing).toHaveBeenCalledWith(summaryData, {
                signal: undefined,
            });
        });
    });

    describe('봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(true);
        });

        it('(Worst) briefing: null과 botBlocked: true를 반환한다', async () => {
            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ briefing: null, botBlocked: true });
        });

        it('(Worst) runBriefing을 호출하지 않는다', async () => {
            await submitMarketBriefingAction('us');

            expect(mockRunBriefing).not.toHaveBeenCalled();
        });
    });

    describe('에러 발생 시', () => {
        it('(Worst) runBriefing이 throw하면 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockRunBriefing.mockRejectedValueOnce(new Error('briefing failed'));

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });

        it('(Worst) getCachedMarketSummary throw 시 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('redis down')
            );

            const result = await submitMarketBriefingAction('us');

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
