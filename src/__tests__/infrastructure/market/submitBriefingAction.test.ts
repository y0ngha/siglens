import { submitBriefingAction } from '@/infrastructure/market/submitBriefingAction';
import { submitBriefing } from '@y0ngha/siglens-core';
import type {
    MarketSummaryData,
    SubmitBriefingResult,
} from '@/domain/types';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    submitBriefing: jest.fn(),
}));

const mockSubmitBriefing = submitBriefing as jest.MockedFunction<
    typeof submitBriefing
>;

const summary = {} as MarketSummaryData;
const submittedResult: SubmitBriefingResult = {
    status: 'submitted',
    jobId: 'briefing-job-1',
};

describe('submitBriefingAction 함수는', () => {
    beforeEach(() => {
        mockSubmitBriefing.mockReset();
    });

    it('summary 데이터를 siglens-core submitBriefing에 그대로 전달한다', async () => {
        mockSubmitBriefing.mockResolvedValueOnce(submittedResult);

        await submitBriefingAction(summary);

        expect(mockSubmitBriefing).toHaveBeenCalledWith(summary);
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockSubmitBriefing.mockResolvedValueOnce(submittedResult);

        const result = await submitBriefingAction(summary);

        expect(result).toBe(submittedResult);
    });
});
