import { postAnalyze } from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables, RawAnalysisResponse } from '@/domain/types';

jest.mock('@/infrastructure/ai/factory');
jest.mock('@/infrastructure/skills/loader');

import { createAIProvider } from '@/infrastructure/ai/factory';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

const mockAnalyze = jest.fn();
(
    createAIProvider as jest.MockedFunction<typeof createAIProvider>
).mockReturnValue({
    analyze: mockAnalyze,
} as unknown as ReturnType<typeof createAIProvider>);

const mockLoadSkills = jest.fn();
(
    FileSkillsLoader as jest.MockedClass<typeof FileSkillsLoader>
).mockImplementation(
    () =>
        ({ loadSkills: mockLoadSkills }) as unknown as InstanceType<
            typeof FileSkillsLoader
        >
);

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

describe('postAnalyze 함수는', () => {
    beforeEach(() => {
        mockAnalyze.mockReset();
        mockLoadSkills.mockReset();
    });

    describe('정상 응답일 때', () => {
        it('AnalyzeRouteResponse를 반환한다', async () => {
            mockLoadSkills.mockResolvedValueOnce([]);
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            const result = await postAnalyze(mockVariables);

            expect(result.summary).toBe(mockRawAnalysis.summary);
            expect(result.trend).toBe(mockRawAnalysis.trend);
            expect(result.skillsDegraded).toBe(false);
        });

        it('AI provider의 analyze()에 buildAnalysisPrompt가 생성한 프롬프트를 전달한다', async () => {
            mockLoadSkills.mockResolvedValueOnce([]);
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            await postAnalyze(mockVariables);

            expect(mockAnalyze).toHaveBeenCalledTimes(1);
            const [prompt] = mockAnalyze.mock.calls[0] as [string];
            expect(typeof prompt).toBe('string');
            expect(prompt).toContain('AAPL');
        });

        it('skills가 있을 때 프롬프트에 skills 정보가 포함된다', async () => {
            const mockSkills = [
                {
                    name: 'Test Skill',
                    description: 'test skill description',
                    content: 'skill content',
                    confidenceWeight: 1,
                    indicators: [],
                    type: 'pattern' as const,
                },
            ];
            mockLoadSkills.mockResolvedValueOnce(mockSkills);
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            await postAnalyze(mockVariables);

            const [prompt] = mockAnalyze.mock.calls[0] as [string];
            expect(prompt).toContain('Test Skill');
        });

        it('enrichAnalysisWithConfidence의 결과에 skillsDegraded: false를 포함하여 반환한다', async () => {
            mockLoadSkills.mockResolvedValueOnce([]);
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            const result = await postAnalyze(mockVariables);

            expect(result.skillsDegraded).toBe(false);
        });
    });

    describe('skills 로딩이 실패할 때', () => {
        it('빈 skills 배열로 분석을 계속하고 skillsDegraded: true를 반환한다', async () => {
            mockLoadSkills.mockRejectedValueOnce(
                new Error('Skills load failed')
            );
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            const result = await postAnalyze(mockVariables);

            expect(result.skillsDegraded).toBe(true);
        });

        it('skills 로딩 실패 시에도 AI 분석은 실행된다', async () => {
            mockLoadSkills.mockRejectedValueOnce(
                new Error('Skills load failed')
            );
            mockAnalyze.mockResolvedValueOnce(mockRawAnalysis);

            await postAnalyze(mockVariables);

            expect(mockAnalyze).toHaveBeenCalledTimes(1);
        });
    });

    describe('필수 파라미터가 누락된 경우', () => {
        it('symbol이 없으면 에러를 던진다', async () => {
            await expect(
                postAnalyze({ ...mockVariables, symbol: '' })
            ).rejects.toThrow('symbol, bars, and indicators are required');
        });

        it('bars가 비어있으면 에러를 던진다', async () => {
            await expect(
                postAnalyze({ ...mockVariables, bars: [] })
            ).rejects.toThrow('symbol, bars, and indicators are required');
        });
    });

    describe('AI 분석이 에러를 던질 때', () => {
        it('에러를 전파한다', async () => {
            mockLoadSkills.mockResolvedValueOnce([]);
            mockAnalyze.mockRejectedValueOnce(new Error('AI analysis failed'));

            await expect(postAnalyze(mockVariables)).rejects.toThrow(
                'AI analysis failed'
            );
        });
    });
});
