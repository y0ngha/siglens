/**
 * Unit tests for fetchMarketNewsDigest.
 *
 * Mocks:
 * - @/entities/market-news/actions — submitMarketNewsDigestAction, pollMarketNewsDigestAction
 * - @/shared/lib/sleep — keeps tests synchronous (resolved immediately)
 *
 * Uses fake timers where relevant to control poll loop pacing.
 */

import type { MockedFunction } from 'vitest';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import {
    submitMarketNewsDigestAction,
    pollMarketNewsDigestAction,
} from '@/entities/market-news/actions';
import { fetchMarketNewsDigest } from '../utils/fetchMarketNewsDigest';

vi.mock('@/entities/market-news/actions', () => ({
    submitMarketNewsDigestAction: vi.fn(),
    pollMarketNewsDigestAction: vi.fn(),
    getMarketNewsCardsAction: vi.fn(),
    ensureMarketNewsCardsAnalyzedAction: vi.fn(),
    cancelMarketNewsDigestAction: vi.fn(),
}));

vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const mockSubmitMarketNewsDigestAction =
    submitMarketNewsDigestAction as MockedFunction<
        typeof submitMarketNewsDigestAction
    >;
const mockPollMarketNewsDigestAction =
    pollMarketNewsDigestAction as MockedFunction<
        typeof pollMarketNewsDigestAction
    >;

const DIGEST_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '연준의 금리 동결 결정이 시장 심리를 지지하고 있습니다.',
    keyEventsKo: ['FOMC 회의 금리 동결 결정'],
    upcomingEventsKo: ['4분기 실적 시즌 본격 개막'],
};

describe('fetchMarketNewsDigest', () => {
    let controller: AbortController;

    beforeEach(() => {
        controller = new AbortController();
        mockSubmitMarketNewsDigestAction.mockReset();
        mockPollMarketNewsDigestAction.mockReset();
    });

    afterEach(() => {
        controller.abort();
    });

    it("status 'cached' → returns result immediately without polling", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'cached',
            result: DIGEST_RESULT,
        });

        const onJobId = vi.fn();
        const result = await fetchMarketNewsDigest(
            'general',
            controller.signal,
            onJobId
        );

        expect(result).toEqual(DIGEST_RESULT);
        expect(mockPollMarketNewsDigestAction).not.toHaveBeenCalled();
        // onJobId is NOT called for cached — no jobId is assigned
        expect(onJobId).not.toHaveBeenCalled();
    });

    it("status 'error' → throws with the provided error message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'error',
            error: '서버 오류가 발생했습니다.',
        });

        await expect(
            fetchMarketNewsDigest('general', controller.signal, vi.fn())
        ).rejects.toThrow('서버 오류가 발생했습니다.');
        expect(mockPollMarketNewsDigestAction).not.toHaveBeenCalled();
    });

    it("status 'no_news' → throws with no-news message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'no_news',
        });

        await expect(
            fetchMarketNewsDigest('general', controller.signal, vi.fn())
        ).rejects.toThrow('분석할 뉴스가 없어요. 잠시 후 다시 시도해 주세요.');
    });

    it("status 'miss_no_trigger' → throws with miss-no-trigger message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'miss_no_trigger',
        });

        await expect(
            fetchMarketNewsDigest('general', controller.signal, vi.fn())
        ).rejects.toThrow(
            '다이제스트를 생성할 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
    });

    it("status 'submitted' → polls until done, resolves with result", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-123',
        });
        mockPollMarketNewsDigestAction
            .mockResolvedValueOnce({ status: 'processing' })
            .mockResolvedValueOnce({ status: 'done', result: DIGEST_RESULT });

        const onJobId = vi.fn();
        const result = await fetchMarketNewsDigest(
            'general',
            controller.signal,
            onJobId
        );

        expect(result).toEqual(DIGEST_RESULT);
        expect(mockPollMarketNewsDigestAction).toHaveBeenCalledTimes(2);
        // onJobId called with jobId when submitted
        expect(onJobId).toHaveBeenCalledWith('job-123');
        // finally block clears: onJobId(null, jobId)
        expect(onJobId).toHaveBeenCalledWith(null, 'job-123');
    });

    it("poll returns status 'error' → throws and still calls onJobId(null, jobId) in finally", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-456',
        });
        mockPollMarketNewsDigestAction.mockResolvedValue({
            status: 'error',
            error: 'worker crashed',
        });

        const onJobId = vi.fn();
        await expect(
            fetchMarketNewsDigest('general', controller.signal, onJobId)
        ).rejects.toThrow('worker crashed');

        // finally must still clear the jobId ref
        expect(onJobId).toHaveBeenCalledWith(null, 'job-456');
    });

    it('AbortSignal aborted before submit → throws aborted immediately', async () => {
        controller.abort();

        // submitMarketNewsDigestAction should NOT even be called
        await expect(
            fetchMarketNewsDigest('general', controller.signal, vi.fn())
        ).rejects.toThrow('aborted');

        expect(mockSubmitMarketNewsDigestAction).not.toHaveBeenCalled();
    });

    it('AbortSignal aborted mid-poll → throws aborted and calls onJobId(null, jobId) in finally', async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-789',
        });

        // First sleep call aborts the controller to simulate mid-poll abort
        const { sleep } = await import('@/shared/lib/sleep');
        (sleep as MockedFunction<typeof sleep>).mockImplementationOnce(
            async () => {
                controller.abort();
            }
        );

        const onJobId = vi.fn();
        await expect(
            fetchMarketNewsDigest('general', controller.signal, onJobId)
        ).rejects.toThrow('aborted');

        // finally must still clean up
        expect(onJobId).toHaveBeenCalledWith(null, 'job-789');
    });

    it('poll error without error string → throws generic fallback message', async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'submitted',
            jobId: 'job-000',
        });
        // Simulate missing error field (cast to bypass type restriction) so the
        // nullish coalescing in fetchMarketNewsDigest falls through to the fallback.
        mockPollMarketNewsDigestAction.mockResolvedValue({
            status: 'error',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            error: null as any,
        });

        await expect(
            fetchMarketNewsDigest('general', controller.signal, vi.fn())
        ).rejects.toThrow('AI 다이제스트 생성 중 오류가 발생했어요.');
    });
});
