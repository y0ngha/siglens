/**
 * Unit tests for fundamental page `buildChatState`.
 *
 * Pure function — verifies that only `done` states publish `context`, and
 * `timeframe` is `null` because fundamental analysis is timeframe-agnostic.
 */
import type { FundamentalAnalysisResponse } from '@y0ngha/siglens-core';
import { buildChatState } from '@/widgets/fundamental/utils/buildChatState';
import type { FundamentalAnalysisState } from '@/widgets/fundamental/hooks/useFundamentalAnalysis';

const FAKE_RESULT = {} as FundamentalAnalysisResponse;

describe('fundamental buildChatState', () => {
    it('done → context: fundamental payload, ready=true', () => {
        const state: FundamentalAnalysisState = {
            status: 'done',
            result: FAKE_RESULT,
        };
        expect(buildChatState(state)).toEqual({
            context: { kind: 'fundamental', payload: FAKE_RESULT },
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
        const state: FundamentalAnalysisState = {
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
