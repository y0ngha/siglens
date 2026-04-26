import { getMarketSummaryAction } from '@/infrastructure/dashboard/getMarketSummaryAction';
import {
    getMarketSummaryWithBriefing,
    type MarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    getMarketSummaryWithBriefing: jest.fn(),
}));

const mockGetSummary = getMarketSummaryWithBriefing as jest.MockedFunction<
    typeof getMarketSummaryWithBriefing
>;

const summary = {
    indices: [],
    sectors: [],
} as unknown as MarketSummaryWithBriefing;

describe('getMarketSummaryAction 함수는', () => {
    beforeEach(() => {
        mockGetSummary.mockReset();
    });

    it('siglens-core getMarketSummaryWithBriefing을 인자 없이 호출한다', async () => {
        mockGetSummary.mockResolvedValueOnce(summary);

        await getMarketSummaryAction();

        expect(mockGetSummary).toHaveBeenCalledWith();
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockGetSummary.mockResolvedValueOnce(summary);

        const result = await getMarketSummaryAction();

        expect(result).toBe(summary);
    });
});
