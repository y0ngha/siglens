import type { MockedFunction } from 'vitest';
import { cancelFundamentalAnalysisJobAction } from '../actions/cancelFundamentalAnalysisJobAction';
import { cancelFundamentalAnalysisJob } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    cancelFundamentalAnalysisJob: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockCancelFundamentalAnalysisJob =
    cancelFundamentalAnalysisJob as MockedFunction<
        typeof cancelFundamentalAnalysisJob
    >;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cancelFundamentalAnalysisJobAction 함수는', () => {
    beforeEach(() => {
        mockCancelFundamentalAnalysisJob.mockReset();
    });

    it('jobId를 siglens-core cancelFundamentalAnalysisJob에 그대로 전달한다', async () => {
        mockCancelFundamentalAnalysisJob.mockResolvedValueOnce(undefined);

        await cancelFundamentalAnalysisJobAction('job-fundamental-001');

        expect(mockCancelFundamentalAnalysisJob).toHaveBeenCalledWith(
            'job-fundamental-001'
        );
    });

    it('underlying 함수가 reject하면 에러를 삼키고 undefined를 반환한다', async () => {
        mockCancelFundamentalAnalysisJob.mockRejectedValueOnce(
            new Error('redis timeout')
        );

        await expect(
            cancelFundamentalAnalysisJobAction('job-fundamental-002')
        ).resolves.toBeUndefined();
    });
});
