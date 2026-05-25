vi.mock('@y0ngha/siglens-core', () => ({
    pollAnalysis: vi.fn(),
}));

vi.mock('@vercel/functions', () => ({
    waitUntil: vi.fn(),
}));

import { pollAnalysisAction } from '@/entities/analysis/actions/pollAnalysisAction';
import { pollAnalysis } from '@y0ngha/siglens-core';

const mockPollAnalysis = pollAnalysis as ReturnType<typeof vi.fn>;

describe('pollAnalysisAction Redis/error scenarios', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('propagates error when pollAnalysis throws (Redis connection fail)', async () => {
        mockPollAnalysis.mockRejectedValue(
            new Error('Redis connection refused')
        );

        await expect(pollAnalysisAction('job-1')).rejects.toThrow(
            'Redis connection refused'
        );
    });

    it('handles error status from poll result', async () => {
        mockPollAnalysis.mockResolvedValue({
            status: 'error',
            message: 'LLM provider failed',
        });

        const result = await pollAnalysisAction('job-2');

        expect(result.status).toBe('error');
    });

    it('handles unexpected shape from poll result', async () => {
        mockPollAnalysis.mockResolvedValue({
            status: 'unknown_status',
        });

        const result = await pollAnalysisAction('job-3');

        expect(result.status).toBe('unknown_status');
    });

    it('handles null data in completed result', async () => {
        mockPollAnalysis.mockResolvedValue({
            status: 'completed',
            data: null,
        });

        const result = await pollAnalysisAction('job-4');

        expect(result.status).toBe('completed');
        expect((result as unknown as { data: unknown }).data).toBeNull();
    });

    it('passes jobId and waitUntil correctly', async () => {
        mockPollAnalysis.mockResolvedValue({ status: 'pending' });

        await pollAnalysisAction('specific-job-id');

        expect(mockPollAnalysis).toHaveBeenCalledWith(
            'specific-job-id',
            expect.objectContaining({ waitUntil: expect.any(Function) })
        );
    });
});
