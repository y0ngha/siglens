import { vi, type MockedFunction } from 'vitest';
import { cancelOverallAnalysisJobAction } from '../actions/cancelOverallAnalysisJobAction';
import { cancelOverallAnalysisJob } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    cancelOverallAnalysisJob: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockCancelOverallAnalysisJob =
    cancelOverallAnalysisJob as MockedFunction<
        typeof cancelOverallAnalysisJob
    >;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cancelOverallAnalysisJobAction 함수는', () => {
    beforeEach(() => {
        mockCancelOverallAnalysisJob.mockReset();
    });

    it('jobId를 siglens-core cancelOverallAnalysisJob에 그대로 전달한다', async () => {
        mockCancelOverallAnalysisJob.mockResolvedValueOnce(undefined);

        await cancelOverallAnalysisJobAction('job-overall-001');

        expect(mockCancelOverallAnalysisJob).toHaveBeenCalledWith(
            'job-overall-001'
        );
    });

    it('underlying 함수가 reject하면 에러를 삼키고 undefined를 반환한다', async () => {
        mockCancelOverallAnalysisJob.mockRejectedValueOnce(
            new Error('network error')
        );

        await expect(
            cancelOverallAnalysisJobAction('job-overall-002')
        ).resolves.toBeUndefined();
    });
});
