/**
 * Unit tests for chart (symbol-page) `buildChatState`.
 *
 * Verifies the bot_blocked/error short-circuit so stale technical payloads
 * never leak to the chatbot, plus the `displayAnalyzing` gating of
 * `isAnalysisReady`.
 */
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import { buildChatState } from '@/views/symbol/utils/buildChatState';

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
                lockedInfoDepth: [],
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
                lockedInfoDepth: [],
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
                lockedInfoDepth: [],
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
                lockedInfoDepth: [],
            })
        ).toEqual({
            context: { kind: 'technical', payload: ANALYSIS },
            timeframe: TIMEFRAME,
            isAnalysisReady: true,
        });
    });

    it('locked detail → context: null, ready=false', () => {
        expect(
            buildChatState({
                analysis: ANALYSIS,
                timeframe: TIMEFRAME,
                displayAnalyzing: false,
                isBotBlocked: false,
                analysisError: null,
                lockedInfoDepth: ['full_detail'],
            })
        ).toEqual({
            context: null,
            timeframe: TIMEFRAME,
            isAnalysisReady: false,
        });
    });
});
