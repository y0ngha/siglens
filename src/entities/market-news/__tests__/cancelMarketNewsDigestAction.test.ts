import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    cancelNewsAnalysisJob: vi.fn(),
}));

describe('cancelMarketNewsDigestAction은', () => {
    beforeEach(() => vi.clearAllMocks());

    it('jobId로 core cancelNewsAnalysisJob을 호출하고 void를 반환한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.cancelNewsAnalysisJob).mockResolvedValue(undefined);

        const { cancelMarketNewsDigestAction } =
            await import('../actions/cancelMarketNewsDigestAction');
        const result = await cancelMarketNewsDigestAction('job-1');

        expect(core.cancelNewsAnalysisJob).toHaveBeenCalledWith('job-1');
        expect(result).toBeUndefined();
    });

    it('core가 throw해도 삼키고(swallow) void로 resolve한다 — best-effort cancel', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.cancelNewsAnalysisJob).mockRejectedValue(
            new Error('network error')
        );

        const { cancelMarketNewsDigestAction } =
            await import('../actions/cancelMarketNewsDigestAction');

        await expect(
            cancelMarketNewsDigestAction('job-1')
        ).resolves.toBeUndefined();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });
});
