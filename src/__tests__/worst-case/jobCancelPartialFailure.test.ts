vi.mock('@y0ngha/siglens-core', () => ({
    cancelAnalysisJob: vi.fn(),
    cancelFundamentalAnalysisJob: vi.fn(),
    cancelNewsAnalysisJob: vi.fn(),
    cancelJob: vi.fn(),
    cancelOverallAnalysisJob: vi.fn(),
}));

import { POST } from '@/app/api/jobs/cancel/route';
import {
    cancelAnalysisJob,
    cancelFundamentalAnalysisJob,
    cancelOverallAnalysisJob,
} from '@y0ngha/siglens-core';

const mockCancelAnalysis = cancelAnalysisJob as ReturnType<typeof vi.fn>;
const mockCancelFundamental = cancelFundamentalAnalysisJob as ReturnType<
    typeof vi.fn
>;
const mockCancelOverall = cancelOverallAnalysisJob as ReturnType<typeof vi.fn>;

function createJsonRequest(body: unknown): Request {
    return new Request('http://localhost/api/jobs/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('Job cancel partial failure behavior', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('returns 204 for empty jobs array (valid but no-op)', async () => {
        const req = createJsonRequest({ jobs: [] });

        const res = await POST(req);

        expect(res.status).toBe(204);
    });

    it('calls correct cancel function for each job type', async () => {
        mockCancelAnalysis.mockResolvedValue(undefined);
        mockCancelFundamental.mockResolvedValue(undefined);
        mockCancelOverall.mockResolvedValue(undefined);

        const req = createJsonRequest({
            jobs: [
                { jobId: 'a1', type: 'analysis' },
                { jobId: 'f1', type: 'fundamental' },
                { jobId: 'o1', type: 'overall' },
            ],
        });

        await POST(req);

        expect(mockCancelAnalysis).toHaveBeenCalledWith('a1');
        expect(mockCancelFundamental).toHaveBeenCalledWith('f1');
        expect(mockCancelOverall).toHaveBeenCalledWith('o1');
    });
});
