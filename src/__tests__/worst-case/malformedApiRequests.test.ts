vi.mock('@y0ngha/siglens-core', () => ({
    cancelAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelNewsAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJob: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from '@/app/api/jobs/cancel/route';

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/jobs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/jobs/cancel malformed requests', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 when body has no jobs array', async () => {
        const req = createJsonRequest({ notJobs: [] });

        const res = await POST(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 when jobs is not an array', async () => {
        const req = createJsonRequest({ jobs: 'string' });

        const res = await POST(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 when a job entry has invalid type', async () => {
        const req = createJsonRequest({
            jobs: [{ jobId: 'j1', type: 'invalid_type' }],
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 when a job entry has missing jobId', async () => {
        const req = createJsonRequest({
            jobs: [{ type: 'analysis' }],
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
    });

    it('returns 400 for non-JSON body', async () => {
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const req = new Request('http://localhost/api/jobs/cancel', {
            method: 'POST',
            body: 'not json',
        });

        const res = await POST(req);

        expect(res.status).toBe(400);
        expect(errorSpy).toHaveBeenCalled();
    });

    it('returns 204 for valid request with mixed job types', async () => {
        const req = createJsonRequest({
            jobs: [
                { jobId: 'j1', type: 'analysis' },
                { jobId: 'j2', type: 'fundamental' },
                { jobId: 'j3', type: 'news' },
            ],
        });

        const res = await POST(req);

        expect(res.status).toBe(204);
    });

    it('returns 204 even when some cancel calls fail (partial failure)', async () => {
        const { cancelAnalysisJob } = await import('@y0ngha/siglens-core');
        (cancelAnalysisJob as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Redis down')
        );

        const req = createJsonRequest({
            jobs: [
                { jobId: 'j1', type: 'analysis' },
                { jobId: 'j2', type: 'fundamental' },
            ],
        });

        const res = await POST(req);

        expect(res.status).toBe(204);
    });

    it('returns 204 when all cancel calls fail', async () => {
        const core = await import('@y0ngha/siglens-core');
        (core.cancelAnalysisJob as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('fail')
        );
        (
            core.cancelFundamentalAnalysisJob as ReturnType<typeof vi.fn>
        ).mockRejectedValue(new Error('fail'));

        const req = createJsonRequest({
            jobs: [
                { jobId: 'j1', type: 'analysis' },
                { jobId: 'j2', type: 'fundamental' },
            ],
        });

        const res = await POST(req);

        expect(res.status).toBe(204);
    });
});
