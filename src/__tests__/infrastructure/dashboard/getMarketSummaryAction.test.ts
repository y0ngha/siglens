import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import {
    getMarketSummary,
    getMarketSummaryWithBriefing,
    type MarketSummaryData,
    type MarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';
import { isBot } from '@/infrastructure/http/isBot';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    getMarketSummaryWithBriefing: jest.fn(),
    getMarketSummary: jest.fn(),
}));

jest.mock('next/headers', () => ({
    headers: jest.fn().mockResolvedValue(new Headers()),
}));

jest.mock('@/infrastructure/http/isBot', () => ({
    isBot: jest.fn(),
}));

const mockGetSummaryWithBriefing =
    getMarketSummaryWithBriefing as jest.MockedFunction<
        typeof getMarketSummaryWithBriefing
    >;
const mockGetSummary = getMarketSummary as jest.MockedFunction<
    typeof getMarketSummary
>;
const mockIsBot = isBot as jest.MockedFunction<typeof isBot>;

const summaryData: MarketSummaryData = { indices: [], sectors: [] };

const summaryWithBriefing: MarketSummaryWithBriefing = {
    summary: summaryData,
    briefing: { status: 'submitted', jobId: 'test-job-id' },
};

describe('getMarketSummaryAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
});
