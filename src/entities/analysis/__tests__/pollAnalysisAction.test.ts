import type { MockedFunction } from 'vitest';
import { pollAnalysisAction } from '../actions/pollAnalysisAction';
import { pollAnalysis } from '@y0ngha/siglens-core';
import type { PollAnalysisResult } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollAnalysis: vi.fn(),
}));

const mockPollAnalysis = pollAnalysis as MockedFunction<typeof pollAnalysis>;

const processingResult: PollAnalysisResult = { status: 'processing' };

describe('pollAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollAnalysis.mockReset();
    });

    it('jobId를 siglens-core pollAnalysis에 그대로 전달한다', async () => {
        mockPollAnalysis.mockResolvedValueOnce(processingResult);

        await pollAnalysisAction('job-123');

        expect(mockPollAnalysis).toHaveBeenCalledWith('job-123');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollAnalysis.mockResolvedValueOnce(processingResult);

        const result = await pollAnalysisAction('job-123');

        expect(result).toBe(processingResult);
    });
});
