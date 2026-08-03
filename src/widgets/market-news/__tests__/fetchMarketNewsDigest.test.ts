/**
 * Unit tests for fetchMarketNewsDigest.
 *
 * Mocks:
 * - @/entities/market-news/actions — submitMarketNewsDigestAction (run* blocking,
 *   no poll loop, no cancel)
 *
 * fetchMarketNewsDigest(category) returns a single promise — no AbortSignal,
 * no onJobId callback.
 */

import type { MockedFunction } from 'vitest';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { submitMarketNewsDigestAction } from '@/entities/market-news/actions';
import { fetchMarketNewsDigest } from '../utils/fetchMarketNewsDigest';

vi.mock('@/entities/market-news/actions', () => ({
    submitMarketNewsDigestAction: vi.fn(),
    getMarketNewsCardsAction: vi.fn(),
    ensureMarketNewsCardsAnalyzedAction: vi.fn(),
}));

const mockSubmitMarketNewsDigestAction =
    submitMarketNewsDigestAction as MockedFunction<
        typeof submitMarketNewsDigestAction
    >;

const DIGEST_RESULT: NewsAnalysisResponse = {
    overallSentiment: 'bullish',
    currentDriverKo: '연준의 금리 동결 결정이 시장 심리를 지지하고 있습니다.',
    keyEventsKo: ['FOMC 회의 금리 동결 결정'],
    upcomingEventsKo: ['4분기 실적 시즌 본격 개막'],
};

describe('fetchMarketNewsDigest', () => {
    beforeEach(() => {
        mockSubmitMarketNewsDigestAction.mockReset();
    });

    it("status 'cached' → returns result immediately", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'cached',
            result: DIGEST_RESULT,
        });

        const result = await fetchMarketNewsDigest('general');

        expect(result).toEqual(DIGEST_RESULT);
    });

    it("status 'done' → returns result immediately", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'done',
            result: DIGEST_RESULT,
        });

        const result = await fetchMarketNewsDigest('general');

        expect(result).toEqual(DIGEST_RESULT);
    });

    it("status 'error' → throws with the provided error message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'error',
            error: '서버 오류가 발생했습니다.',
        });

        await expect(fetchMarketNewsDigest('general')).rejects.toThrow(
            '서버 오류가 발생했습니다.'
        );
    });

    it("status 'no_news' → throws with no-news message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'no_news',
        });

        await expect(fetchMarketNewsDigest('general')).rejects.toThrow(
            '분석할 뉴스가 없어요. 잠시 후 다시 시도해 주세요.'
        );
    });

    it("status 'miss_no_trigger' → throws with miss-no-trigger message", async () => {
        mockSubmitMarketNewsDigestAction.mockResolvedValue({
            status: 'miss_no_trigger',
        });

        await expect(fetchMarketNewsDigest('general')).rejects.toThrow(
            '다이제스트를 생성할 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
    });
});
