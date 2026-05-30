/**
 * Unit tests for news page `buildChatState`.
 *
 * Pure function — verifies that only `done` states publish `context`, and
 * `timeframe` is `null` because news analysis is timeframe-agnostic.
 */
import type { NewsAnalysisResponse } from '@y0ngha/siglens-core';
import { buildChatState } from '@/widgets/news/utils/buildChatState';
import type { NewsAnalysisState } from '@/widgets/news/hooks/useNewsAnalysis';

const FAKE_RESULT = {} as NewsAnalysisResponse;

describe('news buildChatState', () => {
    it('done → context: news payload, ready=true', () => {
        const state: NewsAnalysisState = {
            status: 'done',
            result: FAKE_RESULT,
        };
        expect(buildChatState(state)).toEqual({
            context: { kind: 'news', payload: FAKE_RESULT },
            timeframe: null,
            isAnalysisReady: true,
        });
    });

    it('loading → context: null, ready=false', () => {
        expect(buildChatState({ status: 'loading' })).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('bot_blocked → context: null, ready=false', () => {
        expect(buildChatState({ status: 'bot_blocked' })).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('error → context: null, ready=false', () => {
        const state: NewsAnalysisState = {
            status: 'error',
            error: new Error('boom'),
            retry: () => {},
        };
        expect(buildChatState(state)).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });
});
