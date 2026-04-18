jest.mock('@/infrastructure/dashboard/marketSummaryApi');
jest.mock('@/infrastructure/market/submitBriefingAction');

import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import { getMarketSummary } from '@/infrastructure/dashboard/marketSummaryApi';
import { submitBriefingAction } from '@/infrastructure/market/submitBriefingAction';
import type { MarketSummaryData, SubmitBriefingResult } from '@/domain/types';

const mockGetMarketSummary = getMarketSummary as jest.MockedFunction<
    typeof getMarketSummary
>;
const mockSubmitBriefingAction = submitBriefingAction as jest.MockedFunction<
    typeof submitBriefingAction
>;

const mockSummary: MarketSummaryData = {
    indices: [
        {
            symbol: 'GSPC',
            fmpSymbol: '^GSPC',
            displayName: 'S&P 500',
            koreanName: '미국 대형주 500',
            price: 5200,
            changesPercentage: 0.5,
        },
    ],
    sectors: [
        {
            symbol: 'XLK',
            sectorName: 'Technology',
            koreanName: '기술',
            price: 210,
            changesPercentage: 1.2,
        },
    ],
};

const mockBriefing: SubmitBriefingResult = {
    status: 'submitted',
    jobId: 'test-job-id',
};

describe('getMarketSummaryAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetMarketSummary.mockResolvedValue(mockSummary);
        mockSubmitBriefingAction.mockResolvedValue(mockBriefing);
    });

    describe('정상 동작할 때', () => {
        it('summary와 briefing을 합산하여 반환한다', async () => {
            const result = await getMarketSummaryAction();

            expect(result.summary).toBe(mockSummary);
            expect(result.briefing).toBe(mockBriefing);
        });

        it('getMarketSummary 결과를 submitBriefingAction에 전달한다', async () => {
            await getMarketSummaryAction();

            expect(mockSubmitBriefingAction).toHaveBeenCalledWith(mockSummary);
        });
    });

    describe('getMarketSummary가 실패할 때', () => {
        it('예외를 전파한다', async () => {
            mockGetMarketSummary.mockRejectedValue(
                new Error('Market data fetch failed')
            );

            await expect(getMarketSummaryAction()).rejects.toThrow(
                'Market data fetch failed'
            );
        });
    });

    describe('submitBriefingAction이 실패할 때', () => {
        it('예외를 전파한다', async () => {
            mockSubmitBriefingAction.mockRejectedValue(
                new Error('Briefing submit failed')
            );

            await expect(getMarketSummaryAction()).rejects.toThrow(
                'Briefing submit failed'
            );
        });
    });
});
