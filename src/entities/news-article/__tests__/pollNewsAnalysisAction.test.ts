import { vi, type MockedFunction } from 'vitest';
import { pollNewsAnalysisAction } from '../actions/pollNewsAnalysisAction';
import { pollNewsAnalysis } from '@y0ngha/siglens-core';
import type { PollNewsAnalysisResult } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    pollNewsAnalysis: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockPollNewsAnalysis = pollNewsAnalysis as MockedFunction<
    typeof pollNewsAnalysis
>;

const PROCESSING_RESULT: PollNewsAnalysisResult = { status: 'processing' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollNewsAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollNewsAnalysis.mockReset();
    });

    it('jobId를 siglens-core pollNewsAnalysis에 그대로 전달한다', async () => {
        mockPollNewsAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await pollNewsAnalysisAction('job-news-001');

        expect(mockPollNewsAnalysis).toHaveBeenCalledWith('job-news-001');
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollNewsAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        const result = await pollNewsAnalysisAction('job-abc');

        expect(result).toBe(PROCESSING_RESULT);
    });
});
