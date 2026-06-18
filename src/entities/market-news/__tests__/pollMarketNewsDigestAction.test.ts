import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    pollMarketNewsDigest: vi.fn(),
}));

describe('pollMarketNewsDigestAction은', () => {
    beforeEach(() => vi.clearAllMocks());

    it('pollMarketNewsDigest가 done+result를 반환하면 그대로 전달한다', async () => {
        const doneResult = {
            status: 'done' as const,
            result: {
                currentDriverKo: '흐름',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'bullish' as const,
            },
        };
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.pollMarketNewsDigest).mockResolvedValue(doneResult);

        const { pollMarketNewsDigestAction } =
            await import('../actions/pollMarketNewsDigestAction');
        const r = await pollMarketNewsDigestAction('job-1');

        expect(core.pollMarketNewsDigest).toHaveBeenCalledWith('job-1');
        expect(r).toEqual(doneResult);
    });

    it('core가 throw하면 { status: "error", error: "Poll failed" }를 반환한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.pollMarketNewsDigest).mockRejectedValue(
            new Error('poll network error')
        );

        const { pollMarketNewsDigestAction } =
            await import('../actions/pollMarketNewsDigestAction');
        const r = await pollMarketNewsDigestAction('job-1');

        expect(r.status).toBe('error');
        expect((r as { status: 'error'; error: string }).error).toBe(
            'Poll failed'
        );
    });
});
