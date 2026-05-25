vi.mock('@y0ngha/siglens-core', () => ({
    cancelAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelFundamentalAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelNewsAnalysisJob: vi.fn().mockResolvedValue(undefined),
    cancelJob: vi.fn().mockResolvedValue(undefined),
    cancelOverallAnalysisJob: vi.fn().mockResolvedValue(undefined),
}));

import { constants } from 'node:http2';
import { POST } from '@/app/api/jobs/cancel/route';
import {
    cancelAnalysisJob,
    cancelFundamentalAnalysisJob,
    cancelNewsAnalysisJob,
    cancelJob,
    cancelOverallAnalysisJob,
} from '@y0ngha/siglens-core';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_NO_CONTENT } = constants;

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/jobs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/jobs/cancel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 when body is not valid JSON', async () => {
        const req = new Request('http://localhost/api/jobs/cancel', {
            method: 'POST',
            body: 'not-json',
        });
        const res = await POST(req);
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('returns 400 when jobs is not an array', async () => {
        const res = await POST(makeRequest({ jobs: 'not-array' }));
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('returns 400 when a job entry has no jobId', async () => {
        const res = await POST(makeRequest({ jobs: [{ type: 'analysis' }] }));
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('returns 400 when a job entry has an invalid type', async () => {
        const res = await POST(
            makeRequest({ jobs: [{ jobId: 'j1', type: 'invalid' }] })
        );
        expect(res.status).toBe(HTTP_STATUS_BAD_REQUEST);
    });

    it('returns 204 and dispatches cancel for a single analysis job', async () => {
        const res = await POST(
            makeRequest({ jobs: [{ jobId: 'j1', type: 'analysis' }] })
        );
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(cancelAnalysisJob).toHaveBeenCalledWith('j1');
    });

    it('dispatches each job type to the correct cancel function', async () => {
        const jobs = [
            { jobId: 'a1', type: 'analysis' },
            { jobId: 'f1', type: 'fundamental' },
            { jobId: 'n1', type: 'news' },
            { jobId: 'o1', type: 'options' },
            { jobId: 'v1', type: 'overall' },
        ];
        const res = await POST(makeRequest({ jobs }));
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(cancelAnalysisJob).toHaveBeenCalledWith('a1');
        expect(cancelFundamentalAnalysisJob).toHaveBeenCalledWith('f1');
        expect(cancelNewsAnalysisJob).toHaveBeenCalledWith('n1');
        expect(cancelJob).toHaveBeenCalledWith('o1');
        expect(cancelOverallAnalysisJob).toHaveBeenCalledWith('v1');
    });

    it('returns 204 even when some cancel calls reject', async () => {
        vi.mocked(cancelAnalysisJob).mockRejectedValueOnce(
            new Error('redis down')
        );
        const res = await POST(
            makeRequest({ jobs: [{ jobId: 'j1', type: 'analysis' }] })
        );
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
    });
});
