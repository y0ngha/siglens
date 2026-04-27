import { pollBriefingAction } from '@/infrastructure/market/pollBriefingAction';
import { pollBriefing } from '@y0ngha/siglens-core';
import type { PollBriefingResult } from '@y0ngha/siglens-core';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    pollBriefing: jest.fn(),
}));

const mockPollBriefing = pollBriefing as jest.MockedFunction<
    typeof pollBriefing
>;

const processingResult: PollBriefingResult = { status: 'processing' };

describe('pollBriefingAction 함수는', () => {
    beforeEach(() => {
        mockPollBriefing.mockReset();
    });

    it('jobId를 siglens-core pollBriefing에 그대로 전달한다', async () => {
        mockPollBriefing.mockResolvedValueOnce(processingResult);

        await pollBriefingAction('job-456');

        expect(mockPollBriefing).toHaveBeenCalledWith('job-456', {
            waitUntil: expect.any(Function),
        });
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollBriefing.mockResolvedValueOnce(processingResult);

        const result = await pollBriefingAction('job-456');

        expect(result).toBe(processingResult);
    });
});
