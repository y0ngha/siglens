jest.mock('@/infrastructure/jobs/queue');

import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import { cancelJob } from '@/infrastructure/jobs/queue';

const mockCancelJob = cancelJob as jest.MockedFunction<typeof cancelJob>;

describe('cancelAnalysisJobAction', () => {
    beforeEach(() => {
        mockCancelJob.mockReset();
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('cancelJob에 jobId를 전달한다', async () => {
        mockCancelJob.mockResolvedValueOnce(undefined);

        await cancelAnalysisJobAction('job-abc');

        expect(mockCancelJob).toHaveBeenCalledWith('job-abc');
    });

    it('cancelJob이 실패해도 에러를 전파하지 않는다 (fire-and-forget)', async () => {
        mockCancelJob.mockRejectedValueOnce(new Error('Redis error'));

        await expect(cancelAnalysisJobAction('job-fail')).resolves.toBeUndefined();
    });

    it('cancelJob이 실패하면 경고 로그를 남긴다', async () => {
        mockCancelJob.mockRejectedValueOnce(new Error('Redis error'));

        await cancelAnalysisJobAction('job-fail');

        expect(console.warn).toHaveBeenCalledWith(
            '[cancelAnalysisJobAction] Failed to signal cancellation:',
            'job-fail',
            expect.any(Error)
        );
    });
});
