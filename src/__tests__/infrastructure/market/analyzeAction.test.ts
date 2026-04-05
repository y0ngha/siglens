import { analyzeAction } from '@/infrastructure/market/analyzeAction';
import type { AnalyzeVariables, RawAnalysisResponse } from '@/domain/types';
import type { RunAnalysisResult } from '@/infrastructure/market/analysisApi';

jest.mock('@/infrastructure/market/analysisApi');

import { runAnalysis } from '@/infrastructure/market/analysisApi';

const mockRunAnalysis = runAnalysis as jest.MockedFunction<typeof runAnalysis>;

const mockVariables: AnalyzeVariables = {
    symbol: 'AAPL',
    bars: [
        {
            time: 1705312200,
            open: 100,
            high: 105,
            low: 99,
            close: 103,
            volume: 1000000,
        },
    ],
    indicators: {
        macd: [],
        bollinger: [],
        dmi: [],
        stochastic: [],
        stochRsi: [],
        rsi: [],
        cci: [],
        vwap: [],
        ma: {},
        ema: {},
        volumeProfile: null,
        ichimoku: [],
    },
};

const mockRawAnalysis: RawAnalysisResponse = {
    summary: '테스트 분석 요약',
    trend: 'bullish' as const,
    signals: [],
    skillSignals: [],
    riskLevel: 'low' as const,
    keyLevels: { support: [], resistance: [] },
    priceTargets: {
        bullish: { targets: [], condition: '' },
        bearish: { targets: [], condition: '' },
    },
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
    trendlines: [],
};

const mockResult: RunAnalysisResult = {
    ...mockRawAnalysis,
    skillsDegraded: false,
    patternSummaries: [],
    skillResults: [],
    candlePatterns: [],
};

beforeEach(() => {
    mockRunAnalysis.mockReset();
});

describe('analyzeAction 함수는', () => {
    describe('정상 응답일 때', () => {
        it('runAnalysis에 variables를 그대로 전달하고 결과를 반환한다', async () => {
            mockRunAnalysis.mockResolvedValueOnce(mockResult);

            const result = await analyzeAction(mockVariables);

            expect(mockRunAnalysis).toHaveBeenCalledWith(mockVariables);
            expect(result).toBe(mockResult);
        });

        it('runAnalysis의 반환값을 그대로 반환한다', async () => {
            const resultWithDegradedSkills: RunAnalysisResult = {
                ...mockResult,
                skillsDegraded: true,
            };
            mockRunAnalysis.mockResolvedValueOnce(resultWithDegradedSkills);

            const result = await analyzeAction(mockVariables);

            expect(result.skillsDegraded).toBe(true);
        });
    });

    describe('runAnalysis가 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockRunAnalysis.mockRejectedValueOnce(new Error('Analysis failed'));

            await expect(analyzeAction(mockVariables)).rejects.toThrow(
                'Analysis failed'
            );
        });
    });
});
