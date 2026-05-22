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

// 4축 응답 가짜 인스턴스: chat payload 전달 확인용. 빈 객체가 아닌 explicit
// shape를 사용해 optionsBulletsKo / integratedConclusionKo 필드가 chat context로
// 그대로 전달되는지 확인한다 (rename 후 회귀 방지).
const FOUR_AXIS_RESULT: OverallAnalysisResponse = {
    headlineKo: '헤드라인',
    technicalBulletsKo: ['기술적'],
    fundamentalBulletsKo: ['펀더멘털'],
    newsBulletsKo: ['뉴스'],
    optionsBulletsKo: ['감마 상승'],
    integratedConclusionKo: '통합 결론',
    scenarios: [],
    riskFactorsKo: [],
};

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

    it('done → 4축 응답의 optionsBulletsKo / integratedConclusionKo가 그대로 payload에 전달된다', () => {
        const state: OverallAnalysisState = {
            status: 'done',
            result: FOUR_AXIS_RESULT,
        };
        const next = buildChatState(state, TIMEFRAME);
        expect(next.context).toEqual({
            kind: 'overall',
            payload: FOUR_AXIS_RESULT,
        });
        if (next.context !== null && next.context.kind === 'overall') {
            expect(next.context.payload.optionsBulletsKo).toEqual([
                '감마 상승',
            ]);
            expect(next.context.payload.integratedConclusionKo).toBe(
                '통합 결론'
            );
        }
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
