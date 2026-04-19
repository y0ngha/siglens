import { buildChatPrompt } from '@/domain/chat/buildChatPrompt';
import type { AnalysisResponse } from '@/domain/types';

const MINIMAL_ANALYSIS: AnalysisResponse = {
    summary: 'AAPL is trending upward.',
    trend: 'bullish',
    riskLevel: 'medium',
    indicatorResults: [],
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    strategyResults: [],
    candlePatterns: [],
    trendlines: [],
};

describe('buildChatPrompt 함수는', () => {
    describe('systemPrompt를', () => {
        it('심볼과 타임프레임을 포함한다', () => {
            const result = buildChatPrompt(
                'AAPL',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '지금 사도 돼?'
            );
            expect(result.systemPrompt).toContain('AAPL');
            expect(result.systemPrompt).toContain('1Day');
        });

        it('분석 요약을 포함한다', () => {
            const result = buildChatPrompt(
                'AAPL',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '지금 사도 돼?'
            );
            expect(result.systemPrompt).toContain('AAPL is trending upward.');
        });

        it('actionRecommendation이 있으면 systemPrompt에 포함한다', () => {
            const analysis: AnalysisResponse = {
                ...MINIMAL_ANALYSIS,
                actionRecommendation: {
                    entryRecommendation: 'wait',
                    positionAnalysis: '현재 과매수 구간',
                    entry: '182 이하 진입 고려',
                    exit: '190 도달 시 일부 매도',
                    riskReward: '1:2',
                },
            };
            const result = buildChatPrompt('AAPL', '1Day', analysis, [], '진입 전략?');
            expect(result.systemPrompt).toContain('182 이하 진입 고려');
        });

        it('keyLevels가 있으면 지지/저항 가격을 포함한다', () => {
            const analysis: AnalysisResponse = {
                ...MINIMAL_ANALYSIS,
                keyLevels: {
                    resistance: [{ price: 195.5, reason: 'Previous high' }],
                    support: [{ price: 180.0, reason: 'Moving average' }],
                },
            };
            const result = buildChatPrompt('AAPL', '1Day', analysis, [], '질문');
            expect(result.systemPrompt).toContain('195.50');
            expect(result.systemPrompt).toContain('180.00');
        });

        it('indicatorResults가 있으면 시그널을 포함한다', () => {
            const analysis: AnalysisResponse = {
                ...MINIMAL_ANALYSIS,
                indicatorResults: [
                    {
                        indicatorName: 'RSI',
                        signals: [{ type: 'skill', trend: 'bearish', description: 'Overbought at 75' }],
                    },
                ],
            };
            const result = buildChatPrompt('AAPL', '1Day', analysis, [], '질문');
            expect(result.systemPrompt).toContain('RSI');
            expect(result.systemPrompt).toContain('Overbought at 75');
        });

        it('priceTargets가 있으면 가격 목표를 포함한다', () => {
            const analysis: AnalysisResponse = {
                ...MINIMAL_ANALYSIS,
                priceTargets: {
                    bullish: { targets: [{ price: 200.0, basis: 'Breakout target' }], condition: 'Above 195' },
                    bearish: { targets: [], condition: '' },
                },
            };
            const result = buildChatPrompt('AAPL', '1Day', analysis, [], '질문');
            expect(result.systemPrompt).toContain('200.00');
            expect(result.systemPrompt).toContain('Breakout target');
        });
    });

    describe('messages를', () => {
        it('히스토리 없이 사용자 메시지 하나만 포함한다', () => {
            const result = buildChatPrompt(
                'AAPL',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '지금 사도 돼?'
            );
            expect(result.messages).toHaveLength(1);
            expect(result.messages[0].role).toBe('user');
            expect(result.messages[0].parts[0].text).toBe('지금 사도 돼?');
        });

        it('히스토리가 있으면 히스토리 뒤에 새 메시지를 추가한다', () => {
            const history = [
                { role: 'user' as const, content: '언제 팔아?' },
                { role: 'model' as const, content: 'RSI가 70 넘으면 고려하세요.' },
            ];
            const result = buildChatPrompt(
                'AAPL',
                '1Day',
                MINIMAL_ANALYSIS,
                history,
                '더 쉽게 설명해줘'
            );
            expect(result.messages).toHaveLength(3);
            expect(result.messages[0].parts[0].text).toBe('언제 팔아?');
            expect(result.messages[1].parts[0].text).toBe('RSI가 70 넘으면 고려하세요.');
            expect(result.messages[2].parts[0].text).toBe('더 쉽게 설명해줘');
        });
    });
});
