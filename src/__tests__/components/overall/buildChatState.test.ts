/**
 * Unit tests for overall page `buildChatState`.
 *
 * Pure function — verifies that only `done` states publish `context`, and
 * that the chart `timeframe` is forwarded across all states so the chatbot
 * always has a timeframe to use when the panel is opened.
 */
import type { OverallAnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { buildChatState } from '@/components/overall/utils/buildChatState';
import type { OverallAnalysisState } from '@/components/overall/types';

const FAKE_RESULT = {} as OverallAnalysisResponse;
const TIMEFRAME: Timeframe = '1Day';

describe('overall buildChatState', () => {
    it('done → context: overall payload, timeframe forwarded, ready=true', () => {
        const state: OverallAnalysisState = {
            status: 'done',
            result: FAKE_RESULT,
        };
        expect(buildChatState(state, TIMEFRAME)).toEqual({
            context: { kind: 'overall', payload: FAKE_RESULT },
            timeframe: TIMEFRAME,
            isAnalysisReady: true,
        });
    });

    it.each<OverallAnalysisState>([
        { status: 'idle' },
        { status: 'submitting' },
        { status: 'polling' },
        { status: 'bot_blocked' },
        { status: 'error', error: 'boom' },
    ])('$status → context: null, timeframe forwarded, ready=false', state => {
        expect(buildChatState(state, TIMEFRAME)).toEqual({
            context: null,
            timeframe: TIMEFRAME,
            isAnalysisReady: false,
        });
    });
});
