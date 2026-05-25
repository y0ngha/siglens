import { vi, type MockedFunction } from 'vitest';
import { pollFundamentalAnalysisAction } from '../actions/pollFundamentalAnalysisAction';
import { pollFundamentalAnalysis } from '@y0ngha/siglens-core';
import type { PollFundamentalAnalysisResult } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollFundamentalAnalysis: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockPollFundamentalAnalysis = pollFundamentalAnalysis as MockedFunction<
    typeof pollFundamentalAnalysis
>;

const PROCESSING_RESULT: PollFundamentalAnalysisResult = {
    status: 'processing',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollFundamentalAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollFundamentalAnalysis.mockReset();
    });

    it('jobId를 siglens-core pollFundamentalAnalysis에 그대로 전달한다', async () => {
        mockPollFundamentalAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await pollFundamentalAnalysisAction('job-fundamental-001');

        expect(mockPollFundamentalAnalysis).toHaveBeenCalledWith(
            'job-fundamental-001'
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollFundamentalAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        const result = await pollFundamentalAnalysisAction('job-abc');

        expect(result).toBe(PROCESSING_RESULT);
    });
});
