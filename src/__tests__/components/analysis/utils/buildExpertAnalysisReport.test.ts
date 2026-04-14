import { buildExpertAnalysisReport } from '@/components/analysis/utils/buildExpertAnalysisReport';
import type { AnalysisResponse, ClusteredKeyLevels } from '@/domain/types';

describe('buildExpertAnalysisReport', () => {
    const baseAnalysis: AnalysisResponse = {
        summary:
            '중기 추세는 유지되고 있으나 단기적으로는 저항 돌파 확인이 필요한 구간입니다.',
        trend: 'bullish',
        riskLevel: 'medium',
        indicatorResults: [
            {
                indicatorName: 'RSI',
                signals: [
                    {
                        type: 'skill',
                        trend: 'neutral',
                        description:
                            '과열권은 아니지만 상승 탄력 둔화 여부를 확인해야 합니다.',
                    },
                ],
            },
            {
                indicatorName: 'MACD',
                signals: [
                    {
                        type: 'skill',
                        trend: 'bullish',
                        description:
                            '시그널 상향 우위를 유지하고 있어 추세 자체는 아직 훼손되지 않았습니다.',
                    },
                ],
            },
        ],
        keyLevels: { support: [], resistance: [] },
        priceTargets: {
            bullish: {
                condition: '212.50 상향 안착 시',
                targets: [
                    { price: 218.3, basis: '직전 고점' },
                    { price: 223.4, basis: '확장 구간' },
                ],
            },
            bearish: {
                condition: '202.10 이탈 시',
                targets: [{ price: 196.8, basis: '하단 지지' }],
            },
        },
        patternSummaries: [
            {
                id: 'pattern-1',
                patternName: 'ascending-triangle',
                skillName: '상승 삼각형',
                detected: true,
                trend: 'bullish',
                summary:
                    '상단 저항 테스트가 반복되면서 돌파 시도 가능성이 유지되고 있습니다.',
                confidenceWeight: 0.92,
            },
        ],
        strategyResults: [
            {
                id: 'strategy-1',
                strategyName: 'Breakout',
                trend: 'bullish',
                summary:
                    '저항 상향 안착 전까지는 추격보다 확인 중심 접근이 적절합니다.',
                confidenceWeight: 0.84,
            },
        ],
        candlePatterns: [],
        trendlines: [],
        actionRecommendation: {
            positionAnalysis:
                '현재는 저항 인근 재시험 구간으로, 상단 돌파 여부 확인이 중요합니다.',
            entry: '205.80 부근 지지 확인 시 분할 진입을 검토합니다.',
            exit: '202.10 이탈 시 단기 시나리오를 재평가합니다.',
            riskReward:
                '저항 돌파 전까지는 손익비가 급격히 좋아지는 구간은 아닙니다.',
            entryRecommendation: 'wait',
            entryPrices: [205.8, 202.1],
            stopLoss: 199.4,
            takeProfitPrices: [212.5, 218.3],
        },
    };

    const baseKeyLevels: ClusteredKeyLevels = {
        resistance: [
            {
                price: 212.5,
                reason: '직전 고점 저항',
                count: 2,
                sources: [
                    { price: 212.5, reason: '직전 고점 저항' },
                    { price: 212.6, reason: '피보나치 1.0' },
                ],
            },
        ],
        support: [
            {
                price: 205.8,
                reason: '20일선 지지',
                count: 2,
                sources: [
                    { price: 205.8, reason: '20일선 지지' },
                    { price: 205.7, reason: '거래량 집중대' },
                ],
            },
        ],
        poc: {
            price: 207.25,
            reason: '거래량 중심 가격대',
        },
    };

    it('숫자 구간과 기술적 근거를 포함한 리포트를 생성한다', () => {
        const result = buildExpertAnalysisReport({
            symbol: 'aapl',
            analysis: baseAnalysis,
            keyLevels: baseKeyLevels,
        });

        expect(result).toContain('[AAPL] 기술적 분석 리포트');
        expect(result).toContain('리스크는 보통 수준입니다.');
        expect(result).toContain('212.50');
        expect(result).toContain('205.80');
        expect(result).toContain('207.25');
        expect(result).toContain('기술적 근거:');
        expect(result).toContain('패턴 상승 삼각형');
        expect(result).toContain('전략 Breakout');
        expect(result).toContain('시나리오:');
        expect(result).toContain('대응 관점:');
        expect(result).toContain(
            '추세 재확인 전까지는 관망 관점이 더 적절합니다.'
        );
    });

    it('riskReward 문장을 중간에서 자르지 않는다', () => {
        const analysisWithLongRiskReward: AnalysisResponse = {
            ...baseAnalysis,
            actionRecommendation: {
                ...baseAnalysis.actionRecommendation!,
                riskReward:
                    '풀백 진입 시 (예: 188.22 진입, 187.00 손절, 195.00 목표) 리스크는 1.22, 리워드는 6.78로 약 1:5.5의 유리한 비율을 가집니다. 돌파 진입 시 (예: 190.50 진입, 187.00 손절, 195.00 목표) 손익비는 상대적으로 둔화될 수 있습니다.',
            },
        };

        const result = buildExpertAnalysisReport({
            symbol: 'nvda',
            analysis: analysisWithLongRiskReward,
            keyLevels: baseKeyLevels,
        });

        expect(result).toContain(
            '돌파 진입 시 (예: 190.50 진입, 187.00 손절, 195.00 목표) 손익비는 상대적으로 둔화될 수 있습니다.'
        );
        expect(result).not.toContain('돌파 진입 시 (…');
    });

    it('데이터가 희소해도 빈 섹션 없이 보수적인 기본 문구로 마무리한다', () => {
        const sparseAnalysis: AnalysisResponse = {
            ...baseAnalysis,
            summary: '방향성 확인이 더 필요한 구간입니다.',
            trend: 'neutral',
            riskLevel: 'high',
            indicatorResults: [],
            patternSummaries: [],
            strategyResults: [],
            priceTargets: {
                bullish: { condition: '', targets: [] },
                bearish: { condition: '', targets: [] },
            },
            actionRecommendation: undefined,
        };

        const sparseKeyLevels: ClusteredKeyLevels = {
            support: [],
            resistance: [],
            poc: undefined,
        };

        const result = buildExpertAnalysisReport({
            symbol: 'tsla',
            analysis: sparseAnalysis,
            keyLevels: sparseKeyLevels,
        });

        expect(result).toContain('[TSLA] 기술적 분석 리포트');
        expect(result).toContain(
            '방향성 재확인 전까지 확인 중심 접근이 적절합니다.'
        );
        expect(result).toContain(
            '변동성 확대 가능성을 우선 염두에 둘 필요가 있습니다.'
        );
        expect(result).not.toContain('기술적 근거:\n\n');
        expect(result).not.toContain('시나리오:');
        expect(result).not.toContain('진입 추천');
    });
});
