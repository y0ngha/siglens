import { vi, type MockedFunction } from 'vitest';
import { cancelNewsAnalysisJobAction } from '../actions/cancelNewsAnalysisJobAction';
import { cancelNewsAnalysisJob } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    cancelNewsAnalysisJob: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockCancelNewsAnalysisJob = cancelNewsAnalysisJob as MockedFunction<
    typeof cancelNewsAnalysisJob
>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cancelNewsAnalysisJobAction 함수는', () => {
    beforeEach(() => {
        mockCancelNewsAnalysisJob.mockReset();
    });

    it('jobId를 siglens-core cancelNewsAnalysisJob에 그대로 전달한다', async () => {
        mockCancelNewsAnalysisJob.mockResolvedValueOnce(undefined);

        await cancelNewsAnalysisJobAction('job-news-001');

        expect(mockCancelNewsAnalysisJob).toHaveBeenCalledWith('job-news-001');
    });

    it('underlying 함수가 reject하면 에러를 삼키고 undefined를 반환한다', async () => {
        mockCancelNewsAnalysisJob.mockRejectedValueOnce(
            new Error('connection refused')
        );

        await expect(
            cancelNewsAnalysisJobAction('job-news-002')
        ).resolves.toBeUndefined();
    });
});
