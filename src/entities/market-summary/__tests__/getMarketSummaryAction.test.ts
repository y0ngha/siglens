import type { MockedFunction } from 'vitest';
import { getMarketSummaryAction } from '../actions/getMarketSummaryAction';
import {
    submitBriefing,
    type MarketSummaryData,
    type SubmitBriefingResult,
} from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

vi.mock('server-only', () => ({}));

vi.mock('../lib/marketSummaryCache', () => ({
    getCachedMarketSummary: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    submitBriefing: vi.fn(),
}));

const { mockCookieGet } = vi.hoisted(() => ({ mockCookieGet: vi.fn() }));
vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
    cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

vi.mock('@/shared/api/isBot', () => ({
    isBot: vi.fn(),
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
const mockSubmitBriefing = submitBriefing as MockedFunction<
    typeof submitBriefing
>;
const mockIsBot = isBot as MockedFunction<typeof isBot>;
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

const briefingResult: SubmitBriefingResult = {
    status: 'submitted',
    jobId: 'test-job-id',
};

describe('getMarketSummaryAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCachedMarketSummary.mockResolvedValue(summaryData);
        mockIsE2E.mockReturnValue(false);
        mockCookieGet.mockReturnValue(undefined);
    });

    describe('봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(true);
        });

        it('getCachedMarketSummary를 호출한다', async () => {
            await getMarketSummaryAction();

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider
            );
        });

        it('submitBriefing을 호출하지 않는다', async () => {
            await getMarketSummaryAction();

            expect(mockSubmitBriefing).not.toHaveBeenCalled();
        });

        it('briefing: null과 botBlocked: true를 반환한다', async () => {
            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                summary: summaryData,
                briefing: null,
                botBlocked: true,
            });
        });
    });

    describe('일반 사용자 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(false);
            mockSubmitBriefing.mockResolvedValue(briefingResult);
        });

        it('getCachedMarketSummary와 submitBriefing(summary)를 호출한다', async () => {
            await getMarketSummaryAction();

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider
            );
            expect(mockSubmitBriefing).toHaveBeenCalledWith(summaryData);
        });

        it('briefing과 botBlocked: false를 포함한 결과를 반환한다', async () => {
            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                summary: summaryData,
                briefing: briefingResult,
                botBlocked: false,
            });
        });
    });

    describe('E2E 모드에서는', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(false);
            mockIsE2E.mockReturnValue(true);
        });

        it('summary는 가져오되 submitBriefing은 호출하지 않는다', async () => {
            const result = await getMarketSummaryAction();

            expect(mockGetCachedMarketSummary).toHaveBeenCalledWith(
                mockProvider
            );
            expect(mockSubmitBriefing).not.toHaveBeenCalled();
            expect(result).toEqual({
                summary: summaryData,
                briefing: null,
                botBlocked: false,
            });
        });

        it('force-partial 쿠키가 없으면 summary를 그대로 반환한다', async () => {
            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                summary: summaryData,
                briefing: null,
                botBlocked: false,
            });
        });

        it('force-partial 쿠키가 있으면 첫 섹터 quote를 0으로 만들어 반환한다', async () => {
            mockCookieGet.mockReturnValue({
                name: 'e2e_force_market_partial',
                value: '1',
            });

            const result = await getMarketSummaryAction();

            expect('ok' in result).toBe(false);
            if ('ok' in result) return;
            expect(result.botBlocked).toBe(false);
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
        it('getCachedMarketSummary 예외 시 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('network timeout')
            );

            const result = await getMarketSummaryAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });

        it('submitBriefing 예외 시 briefing: null을 반환하고 에러를 발생시키지 않는다', async () => {
            mockIsBot.mockReturnValue(false);
            mockSubmitBriefing.mockRejectedValueOnce(
                new Error('briefing failed')
            );

            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                summary: summaryData,
                briefing: null,
                botBlocked: false,
            });
        });

        it('봇 요청에서 getCachedMarketSummary 예외 시 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(true);
            mockGetCachedMarketSummary.mockRejectedValueOnce(
                new Error('API unavailable')
            );

            const result = await getMarketSummaryAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
