import { buildChatState } from '@/widgets/congress/utils/buildChatState';
import type { CongressTrendState } from '@/widgets/congress/hooks/useCongressTrend';
import type { CongressTrendResponse } from '@y0ngha/siglens-core';

const RESULT: CongressTrendResponse = {
    summaryKo: '테스트 요약',
    notableMembersKo: [],
    riskNoteKo: '테스트 위험',
    overallSentiment: 'neutral',
};

describe('buildChatState (congress)', () => {
    it('done 상태에서 congress context와 isAnalysisReady:true를 반환한다', () => {
        const state: CongressTrendState = { status: 'done', result: RESULT };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: { kind: 'congress', payload: RESULT },
            timeframe: null,
            isAnalysisReady: true,
        });
    });

    it('loading 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: CongressTrendState = { status: 'loading' };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('no_trades 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: CongressTrendState = { status: 'no_trades' };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('bot_blocked 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: CongressTrendState = { status: 'bot_blocked' };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('error 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: CongressTrendState = {
            status: 'error',
            error: new Error('test error'),
            retry: () => {},
        };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('timeframe은 항상 null이다', () => {
        const doneState: CongressTrendState = {
            status: 'done',
            result: RESULT,
        };
        const noTradesState: CongressTrendState = { status: 'no_trades' };

        expect(buildChatState(doneState).timeframe).toBeNull();
        expect(buildChatState(noTradesState).timeframe).toBeNull();
    });
});
