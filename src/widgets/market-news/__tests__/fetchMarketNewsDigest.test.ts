/**
 * Unit tests for fetchMarketNewsDigest.
 *
 * Mocks:
 * - @/shared/hooks/useAnalysisStream — runAnalysisStream (SSE 한 연결, 폴 루프 없음)
 *
 * fetchMarketNewsDigest(category, signal)은 단일 프로미스를 반환한다.
 */

import type { MockedFunction } from 'vitest';
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';
import { fetchMarketNewsDigest } from '../utils/fetchMarketNewsDigest';

vi.mock('@/shared/hooks/useAnalysisStream', () => ({
    runAnalysisStream: vi.fn(),
}));

const mockSubmitMarketNewsDigestAction = runAnalysisStream as MockedFunction<
    typeof runAnalysisStream
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
        // type 문자열이 잘못되면 SSE 라우트가 400을 반환한다 — 프로덕션 버그를 테스트에서 잡는다.
        expect(mockSubmitMarketNewsDigestAction).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'marketNewsDigest' })
        );
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
