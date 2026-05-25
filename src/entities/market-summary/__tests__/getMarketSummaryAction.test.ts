import type { MockedFunction } from 'vitest';
import { getMarketSummaryAction } from '../actions/getMarketSummaryAction';
import {
    getMarketSummary,
    getMarketSummaryWithBriefing,
    type MarketSummaryData,
    type MarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';
import { isBot } from '@/shared/api/isBot';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    getMarketSummaryWithBriefing: vi.fn(),
    getMarketSummary: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/shared/api/isBot', () => ({
    isBot: vi.fn(),
}));

const mockGetSummaryWithBriefing =
    getMarketSummaryWithBriefing as MockedFunction<
        typeof getMarketSummaryWithBriefing
    >;
const mockGetSummary = getMarketSummary as MockedFunction<
    typeof getMarketSummary
>;
const mockIsBot = isBot as MockedFunction<typeof isBot>;

const summaryData: MarketSummaryData = { indices: [], sectors: [] };

const summaryWithBriefing: MarketSummaryWithBriefing = {
    summary: summaryData,
    briefing: { status: 'submitted', jobId: 'test-job-id' },
};

describe('getMarketSummaryAction 함수는', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('일반 사용자 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(false);
        });

        it('getMarketSummaryWithBriefing을 호출한다', async () => {
            mockGetSummaryWithBriefing.mockResolvedValueOnce(
                summaryWithBriefing
            );

            await getMarketSummaryAction();

            expect(mockGetSummaryWithBriefing).toHaveBeenCalled();
            expect(mockGetSummary).not.toHaveBeenCalled();
        });

        it('briefing과 botBlocked: false를 포함한 결과를 반환한다', async () => {
            mockGetSummaryWithBriefing.mockResolvedValueOnce(
                summaryWithBriefing
            );

            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                ...summaryWithBriefing,
                botBlocked: false,
            });
        });
    });

    describe('봇 요청 시', () => {
        beforeEach(() => {
            mockIsBot.mockReturnValue(true);
        });

        it('getMarketSummary만 호출한다 (briefing 없이)', async () => {
            mockGetSummary.mockResolvedValueOnce(summaryData);

            await getMarketSummaryAction();

            expect(mockGetSummary).toHaveBeenCalled();
            expect(mockGetSummaryWithBriefing).not.toHaveBeenCalled();
        });

        it('briefing: null과 botBlocked: true를 반환한다', async () => {
            mockGetSummary.mockResolvedValueOnce(summaryData);

            const result = await getMarketSummaryAction();

            expect(result).toEqual({
                summary: summaryData,
                briefing: null,
                botBlocked: true,
            });
        });
    });

    describe('API 에러 발생 시', () => {
        it('일반 사용자 요청에서 예외가 발생하면 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(false);
            mockGetSummaryWithBriefing.mockRejectedValueOnce(
                new Error('network timeout')
            );

            const result = await getMarketSummaryAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });

        it('봇 요청에서 예외가 발생하면 에러 결과를 반환한다', async () => {
            mockIsBot.mockReturnValue(true);
            mockGetSummary.mockRejectedValueOnce(new Error('API unavailable'));

            const result = await getMarketSummaryAction();

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
