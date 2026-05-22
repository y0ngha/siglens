/**
 * Unit tests for fear-greed page `buildChatState`.
 *
 * Pure function — fear-greed data is *not* published as chat context (kind 도
 * 정의되어 있지 않다). snapshot 존재 여부로 `isAnalysisReady`만 토글한다.
 */
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { buildChatState } from '@/components/fear-greed/utils/buildChatState';

describe('fear-greed buildChatState', () => {
    it('snapshot null → context: null, ready=false', () => {
        expect(buildChatState(null)).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('snapshot present → context: null, ready=true', () => {
        const snapshot = {} as FearGreedSnapshot;
        expect(buildChatState(snapshot)).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: true,
        });
    });
});
