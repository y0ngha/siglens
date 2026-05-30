/**
 * Unit tests for chart (symbol-page) `buildChatState`.
 *
 * Verifies the bot_blocked/error short-circuit so stale technical payloads
 * never leak to the chatbot, plus the `displayAnalyzing` gating of
 * `isAnalysisReady`.
 */
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { buildChatState } from '@/widgets/symbol-page/utils/buildChatState';

const ANALYSIS = {} as AnalysisResponse;
const TIMEFRAME: Timeframe = '1Day';

describe('chart buildChatState', () => {
    it('isBotBlocked → context: null, ready=false', () => {
        expect(
            buildChatState({
                analysis: ANALYSIS,
                timeframe: TIMEFRAME,
                displayAnalyzing: false,
                isBotBlocked: true,
                analysisError: null,
            })
        ).toEqual({
            context: null,
            timeframe: TIMEFRAME,
            isAnalysisReady: false,
        });
    });

    it('analysisError → context: null, ready=false', () => {
        expect(
            buildChatState({
                analysis: ANALYSIS,
                timeframe: TIMEFRAME,
                displayAnalyzing: false,
                isBotBlocked: false,
                analysisError: 'boom',
            })
        ).toEqual({
            context: null,
            timeframe: TIMEFRAME,
            isAnalysisReady: false,
        });
    });

    it('displayAnalyzing → context published, ready=false', () => {
        expect(
            buildChatState({
                analysis: ANALYSIS,
                timeframe: TIMEFRAME,
                displayAnalyzing: true,
                isBotBlocked: false,
                analysisError: null,
            })
        ).toEqual({
            context: { kind: 'technical', payload: ANALYSIS },
            timeframe: TIMEFRAME,
            isAnalysisReady: false,
        });
    });

    it('normal → context published, ready=true', () => {
        expect(
            buildChatState({
                analysis: ANALYSIS,
                timeframe: TIMEFRAME,
                displayAnalyzing: false,
                isBotBlocked: false,
                analysisError: null,
            })
        ).toEqual({
            context: { kind: 'technical', payload: ANALYSIS },
            timeframe: TIMEFRAME,
            isAnalysisReady: true,
        });
    });
});
