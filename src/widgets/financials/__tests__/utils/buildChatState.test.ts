import { buildChatState } from '@/widgets/financials/utils/buildChatState';
import type { FinancialsAnalysisState } from '@/widgets/financials/hooks/useFinancialsAnalysis';
import type { FinancialsAnalysisResponse } from '@y0ngha/siglens-core';

const RESULT: FinancialsAnalysisResponse = {
    overallSentiment: 'bullish',
    overallConclusionKo: '테스트 결론',
    axisAssessments: [],
    riskFactorsKo: [],
};

describe('buildChatState', () => {
    it('done 상태에서 financials context와 isAnalysisReady:true를 반환한다', () => {
        const state: FinancialsAnalysisState = {
            status: 'done',
            result: RESULT,
            trigger: () => {},
        };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: { kind: 'financials', payload: RESULT },
            timeframe: null,
            isAnalysisReady: true,
        });
    });

    it('loading 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: FinancialsAnalysisState = {
            status: 'loading',
            trigger: () => {},
        };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('bot_blocked 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: FinancialsAnalysisState = {
            status: 'bot_blocked',
            trigger: () => {},
        };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('error 상태에서 context:null, isAnalysisReady:false를 반환한다', () => {
        const state: FinancialsAnalysisState = {
            status: 'error',
            error: new Error('test error'),
            retry: () => {},
            trigger: () => {},
        };

        const chatState = buildChatState(state);

        expect(chatState).toEqual({
            context: null,
            timeframe: null,
            isAnalysisReady: false,
        });
    });

    it('timeframe은 항상 null이다', () => {
        const doneState: FinancialsAnalysisState = {
            status: 'done',
            result: RESULT,
            trigger: () => {},
        };
        const loadingState: FinancialsAnalysisState = {
            status: 'loading',
            trigger: () => {},
        };

        expect(buildChatState(doneState).timeframe).toBeNull();
        expect(buildChatState(loadingState).timeframe).toBeNull();
    });
});
