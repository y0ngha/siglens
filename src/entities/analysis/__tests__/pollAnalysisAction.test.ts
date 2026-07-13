import type { MockedFunction } from 'vitest';
import { pollAnalysisAction } from '../actions/pollAnalysisAction';
import { pollAnalysis } from '@y0ngha/siglens-core';
import type { PollAnalysisResult } from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollAnalysis: vi.fn(),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierOnly: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';

const mockPollAnalysis = pollAnalysis as MockedFunction<typeof pollAnalysis>;

const processingResult: PollAnalysisResult = { status: 'processing' };

describe('pollAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollAnalysis.mockReset();
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        vi.mocked(resolveTierOnly).mockResolvedValue('free');
    });

    it('resolves the caller tier and forwards it to siglens-core pollAnalysis', async () => {
        mockPollAnalysis.mockResolvedValueOnce(processingResult);

        await pollAnalysisAction('job-123');

        expect(resolveTierOnly).toHaveBeenCalledWith(null);
        expect(mockPollAnalysis).toHaveBeenCalledWith('job-123', {
            tier: 'free',
        });
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollAnalysis.mockResolvedValueOnce(processingResult);

        const result = await pollAnalysisAction('job-123');

        expect(result).toBe(processingResult);
    });

    it('caller tier를 확인하지 못하면 free tier로 fail-closed polling한다', async () => {
        vi.mocked(getCurrentUser).mockRejectedValueOnce(
            new Error('auth unavailable')
        );
        mockPollAnalysis.mockResolvedValueOnce(processingResult);

        await expect(pollAnalysisAction('job-123')).resolves.toBe(
            processingResult
        );
        expect(mockPollAnalysis).toHaveBeenCalledWith('job-123', {
            tier: 'free',
        });
    });

    it('free fallback polling failure returns a typed error', async () => {
        vi.mocked(getCurrentUser).mockRejectedValueOnce(
            new Error('auth unavailable')
        );
        mockPollAnalysis.mockRejectedValueOnce(new Error('redis unavailable'));

        await expect(pollAnalysisAction('job-123')).resolves.toEqual({
            status: 'error',
            error: 'Analysis poll is temporarily unavailable.',
        });
    });
});
