jest.mock('@/infrastructure/jobs/queue');

import { cancelAnalysisJobAction } from '@/infrastructure/market/cancelAnalysisJobAction';
import { cancelJob } from '@/infrastructure/jobs/queue';

const mockCancelJob = cancelJob as jest.MockedFunction<typeof cancelJob>;

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

describe('cancelAnalysisJobAction', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        mockCancelJob.mockReset();
        mockFetch.mockReset();
        global.fetch = mockFetch;
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
        global.fetch = originalFetch;
        delete process.env.WORKER_URL;
        delete process.env.WORKER_SECRET;
        jest.restoreAllMocks();
    });

    it('cancelJob에 jobId를 전달한다', async () => {
        mockCancelJob.mockResolvedValueOnce(undefined);

        await cancelAnalysisJobAction('job-abc');

        expect(mockCancelJob).toHaveBeenCalledWith('job-abc');
    });

    it('cancelJob이 실패해도 에러를 전파하지 않는다 (fire-and-forget)', async () => {
        mockCancelJob.mockRejectedValueOnce(new Error('Redis error'));

        await expect(
            cancelAnalysisJobAction('job-fail')
        ).resolves.toBeUndefined();
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

    describe('WORKER_URL/WORKER_SECRET 설정 시', () => {
        beforeEach(() => {
            process.env.WORKER_URL = 'https://worker.test';
            process.env.WORKER_SECRET = 'test-secret';
            mockCancelJob.mockResolvedValue(undefined);
            mockFetch.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));
        });

        afterEach(() => {
            delete process.env.WORKER_URL;
            delete process.env.WORKER_SECRET;
        });

        it('워커 /cancel 엔드포인트에 POST 요청을 보낸다', async () => {
            await cancelAnalysisJobAction('job-xyz');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://worker.test/cancel',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-Worker-Secret': 'test-secret',
                    }),
                    body: JSON.stringify({ jobId: 'job-xyz' }),
                })
            );
        });

        it('fetch 실패해도 에러를 전파하지 않는다', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));

            await expect(
                cancelAnalysisJobAction('job-net-fail')
            ).resolves.toBeUndefined();
        });

        it('fetch 실패 시 경고 로그를 남긴다', async () => {
            mockFetch.mockRejectedValueOnce(new Error('network error'));

            await cancelAnalysisJobAction('job-net-fail');

            expect(console.warn).toHaveBeenCalledWith(
                '[cancelAnalysisJobAction] Failed to signal cancellation:',
                'job-net-fail',
                expect.any(Error)
            );
        });
    });

    describe('WORKER_URL/WORKER_SECRET 미설정 시', () => {
        it('fetch를 호출하지 않는다', async () => {
            mockCancelJob.mockResolvedValueOnce(undefined);

            await cancelAnalysisJobAction('job-no-worker');

            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('WORKER_URL만 설정된 경우 fetch를 호출하지 않는다', async () => {
            process.env.WORKER_URL = 'https://worker.test';
            mockCancelJob.mockResolvedValueOnce(undefined);

            await cancelAnalysisJobAction('job-partial');

            expect(mockFetch).not.toHaveBeenCalled();
            delete process.env.WORKER_URL;
        });

        it('WORKER_SECRET만 설정된 경우 fetch를 호출하지 않는다', async () => {
            process.env.WORKER_SECRET = 'test-secret';
            mockCancelJob.mockResolvedValueOnce(undefined);

            await cancelAnalysisJobAction('job-partial');

            expect(mockFetch).not.toHaveBeenCalled();
            delete process.env.WORKER_SECRET;
        });
    });
});
