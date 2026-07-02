/**
 * Unit tests for options page `buildChatState`.
 *
 * Pure function — verifies that only `done` states publish a `context`,
 * while loading/error/bot_blocked all collapse to `null` so the chatbot
 * never references partial or stale results.
 */
import type { OptionsAnalysisResponse } from '@y0ngha/siglens-core';
import { buildChatState } from '@/widgets/options/utils/buildChatState';
import type { OptionsAnalysisState } from '@/widgets/options/hooks/useOptionsAnalysis';

const FAKE_RESULT = {} as OptionsAnalysisResponse;

describe('options buildChatState', () => {
    it('done → context: options payload, ready=true', () => {
        const state: OptionsAnalysisState = {
            status: 'done',
            result: FAKE_RESULT,
            trigger: () => {},
        };
        expect(buildChatState(state)).toEqual({
            context: { kind: 'options', payload: FAKE_RESULT },
            timeframe: null,
            isAnalysisReady: true,
        });
    });

    it('loading → context: null, ready=false', () => {
        expect(
            buildChatState({ status: 'loading', trigger: () => {} })
        ).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('bot_blocked → context: null, ready=false', () => {
        expect(
            buildChatState({ status: 'bot_blocked', trigger: () => {} })
        ).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('error → context: null, ready=false', () => {
        const state: OptionsAnalysisState = {
            status: 'error',
            error: new Error('boom'),
            retry: () => {},
            trigger: () => {},
        };
        expect(buildChatState(state)).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });
});
