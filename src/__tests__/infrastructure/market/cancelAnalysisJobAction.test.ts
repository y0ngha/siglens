import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import { cancelAnalysisJob } from '@y0ngha/siglens-core';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    cancelAnalysisJob: jest.fn(),
}));

const mockCancelAnalysisJob = cancelAnalysisJob as jest.MockedFunction<
    typeof cancelAnalysisJob
>;

describe('cancelAnalysisJobAction 함수는', () => {
    beforeEach(() => {
        mockCancelAnalysisJob.mockReset();
    });

    it('jobId를 siglens-core cancelAnalysisJob에 그대로 전달한다', async () => {
        mockCancelAnalysisJob.mockResolvedValueOnce(undefined);

        await cancelAnalysisJobAction('job-123');

        expect(mockCancelAnalysisJob).toHaveBeenCalledWith('job-123');
    });

    it('underlying 함수가 reject하면 에러를 삼키고 undefined를 반환한다', async () => {
        mockCancelAnalysisJob.mockRejectedValueOnce(new Error('network error'));

        await expect(
            cancelAnalysisJobAction('job-456')
        ).resolves.toBeUndefined();
    });
});
