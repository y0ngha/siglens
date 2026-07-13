import type { MockedFunction } from 'vitest';
import { pollOverallAnalysisAction } from '../actions/pollOverallAnalysisAction';
import { pollOverallAnalysis } from '@y0ngha/siglens-core';
import type { PollOverallAnalysisResult } from '@y0ngha/siglens-core';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    pollOverallAnalysis: vi.fn(),
}));
vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    resolveTierOnly: vi.fn(),
}));

import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';

// ---------------------------------------------------------------------------
// Typed mock
// ---------------------------------------------------------------------------

const mockPollOverallAnalysis = pollOverallAnalysis as MockedFunction<
    typeof pollOverallAnalysis
>;

const PROCESSING_RESULT: PollOverallAnalysisResult = { status: 'processing' };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pollOverallAnalysisAction 함수는', () => {
    beforeEach(() => {
        mockPollOverallAnalysis.mockReset();
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        vi.mocked(resolveTierOnly).mockResolvedValue('free');
    });

    it('resolves the caller tier and forwards it to siglens-core pollOverallAnalysis', async () => {
        mockPollOverallAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await pollOverallAnalysisAction('job-overall-001');

        expect(resolveTierOnly).toHaveBeenCalledWith(null);
        expect(mockPollOverallAnalysis).toHaveBeenCalledWith(
            'job-overall-001',
            { tier: 'free' }
        );
    });

    it('underlying 함수의 결과를 그대로 반환한다', async () => {
        mockPollOverallAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        const result = await pollOverallAnalysisAction('job-xyz');

        expect(result).toBe(PROCESSING_RESULT);
    });

    it('caller tier를 확인하지 못하면 free tier로 fail-closed polling한다', async () => {
        vi.mocked(getCurrentUser).mockRejectedValueOnce(
            new Error('auth unavailable')
        );
        mockPollOverallAnalysis.mockResolvedValueOnce(PROCESSING_RESULT);

        await expect(
            pollOverallAnalysisAction('job-overall-001')
        ).resolves.toBe(PROCESSING_RESULT);
        expect(mockPollOverallAnalysis).toHaveBeenCalledWith(
            'job-overall-001',
            { tier: 'free' }
        );
    });

    it('free fallback polling failure returns a typed error', async () => {
        vi.mocked(getCurrentUser).mockRejectedValueOnce(
            new Error('auth unavailable')
        );
        mockPollOverallAnalysis.mockRejectedValueOnce(
            new Error('redis unavailable')
        );

        await expect(
            pollOverallAnalysisAction('job-overall-001')
        ).resolves.toEqual({
            status: 'error',
            error: 'Overall analysis poll is temporarily unavailable.',
        });
    });
});
