import { pollOverallAnalysisAction } from '../actions/pollOverallAnalysisAction';
import { pollOverallAnalysis } from '@y0ngha/siglens-core';
import type { PollOverallAnalysisResult } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    pollOverallAnalysis: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockPollOverallAnalysis = pollOverallAnalysis as jest.MockedFunction<
    typeof pollOverallAnalysis
>;

const PROCESSING_RESULT: PollOverallAnalysisResult = { status: 'processing' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollOverallAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollOverallAnalysis.mockReset();
    });

    it('jobId를 siglens-core pollOverallAnalysis에 그대로 전달한다', async () => {
        mockPollOverallAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await pollOverallAnalysisAction('job-overall-001');

        expect(mockPollOverallAnalysis).toHaveBeenCalledWith('job-overall-001');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollOverallAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        const result = await pollOverallAnalysisAction('job-xyz');

        expect(result).toBe(PROCESSING_RESULT);
    });
});
