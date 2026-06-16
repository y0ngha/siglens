import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/api/isBot', () => ({ isBot: vi.fn(() => false) }));
vi.mock('@y0ngha/siglens-core', async orig => ({
    ...(await orig()),
    submitMarketNewsDigest: vi.fn(),
    pollMarketNewsDigest: vi.fn(),
    cancelNewsAnalysisJob: vi.fn(),
}));

// Mock getMarketNewsList to return 1 enriched row
vi.mock('../api', () => ({
    getMarketNewsList: vi.fn(async () => [
        {
            id: 'm1',
            symbol: '__NEWS_CRYPTO__',
            source: 'CoinWire',
            url: 'https://x/btc',
            publishedAt: '2026-06-15T10:00:00.000Z',
            titleEn: 'BTC ETF inflows',
            titleKo: 'BTC ETF 유입',
            bodyEn: null,
            bodyKo: null,
            summaryKo: '유입',
            sentiment: 'bullish',
            category: 'macro',
            priceImpact: 'high',
            tickers: ['BTCUSD'],
            analyzedAt: new Date(),
        },
    ]),
}));

describe('submitMarketNewsDigestAction은', () => {
    beforeEach(() => vi.clearAllMocks());

    it('봇이면 skipEnqueueIfMiss=true로 core를 호출한다', async () => {
        const { isBot } = await import('@/shared/api/isBot');
        vi.mocked(isBot).mockReturnValue(true);
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.submitMarketNewsDigest).mockResolvedValue({
            status: 'miss_no_trigger',
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        await submitMarketNewsDigestAction('crypto');

        expect(core.submitMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({
                skipEnqueueIfMiss: true,
                category: 'crypto',
                categoryLabel: '미국 암호화폐',
            })
        );
    });

    it('사람 + 캐시 미스면 submitted(jobId)를 반환한다', async () => {
        // Pin isBot to false so this human-path test is independent of the bot
        // test's mockReturnValue(true) (clearAllMocks resets call history, not impl).
        const { isBot } = await import('@/shared/api/isBot');
        vi.mocked(isBot).mockReturnValue(false);
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.submitMarketNewsDigest).mockResolvedValue({
            status: 'submitted',
            jobId: 'j1',
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto');

        expect(r.status).toBe('submitted');
        // Symmetric guard for the bot test: a non-bot must pass skipEnqueueIfMiss=false.
        expect(core.submitMarketNewsDigest).toHaveBeenCalledWith(
            expect.objectContaining({ skipEnqueueIfMiss: false })
        );
    });

    it('core가 cached를 반환하면 그대로 전달한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.submitMarketNewsDigest).mockResolvedValue({
            status: 'cached',
            result: {
                currentDriverKo: '흐름',
                keyEventsKo: [],
                upcomingEventsKo: [],
                overallSentiment: 'bullish',
            },
        });

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto');

        expect(r.status).toBe('cached');
    });

    it('예외 발생 시 throw하지 않고 no_news를 반환한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.submitMarketNewsDigest).mockRejectedValue(
            new Error('core error')
        );

        const { submitMarketNewsDigestAction } =
            await import('../actions/submitMarketNewsDigestAction');
        const r = await submitMarketNewsDigestAction('crypto');

        expect(r.status).toBe('no_news');
    });
});

describe('pollMarketNewsDigestAction은', () => {
    beforeEach(() => vi.clearAllMocks());

    it('core pollMarketNewsDigest를 위임하고 결과를 반환한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.pollMarketNewsDigest).mockResolvedValue({
            status: 'processing',
        });

        const { pollMarketNewsDigestAction } =
            await import('../actions/pollMarketNewsDigestAction');
        const r = await pollMarketNewsDigestAction('job-1');

        expect(core.pollMarketNewsDigest).toHaveBeenCalledWith('job-1');
        expect(r.status).toBe('processing');
    });

    it('예외 발생 시 throw하지 않고 error 상태를 반환한다', async () => {
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

describe('cancelMarketNewsDigestAction은', () => {
    beforeEach(() => vi.clearAllMocks());

    it('core cancelNewsAnalysisJob을 호출한다', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.cancelNewsAnalysisJob).mockResolvedValue(undefined);

        const { cancelMarketNewsDigestAction } =
            await import('../actions/cancelMarketNewsDigestAction');
        await cancelMarketNewsDigestAction('job-1');

        expect(core.cancelNewsAnalysisJob).toHaveBeenCalledWith('job-1');
    });

    it('취소 중 에러를 삼킨다 (swallow)', async () => {
        const core = await import('@y0ngha/siglens-core');
        vi.mocked(core.cancelNewsAnalysisJob).mockRejectedValue(
            new Error('network error')
        );

        const { cancelMarketNewsDigestAction } =
            await import('../actions/cancelMarketNewsDigestAction');

        // Should not throw
        await expect(
            cancelMarketNewsDigestAction('job-1')
        ).resolves.toBeUndefined();
    });
});
