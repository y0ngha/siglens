import { GoogleGenAI } from '@google/genai';
import { GeminiProvider } from '@/infrastructure/ai/gemini';
import type { RawAnalysisResponse } from '@/domain/types';

jest.mock('@google/genai');

describe('GeminiProvider', () => {
    let mockGenerateContent: jest.Mock;
    let provider: GeminiProvider;

    const mockAnalysisResponse: RawAnalysisResponse = {
        summary: 'Test summary',
        trend: 'bullish',
        indicatorResults: [],
        riskLevel: 'low',
        keyLevels: {
            support: [{ price: 100, reason: '이전 저점' }],
            resistance: [{ price: 110, reason: '이전 고점' }],
        },
        priceTargets: {
            bullish: {
                targets: [{ price: 115, basis: '이중바닥 목표가' }],
                condition: '110 돌파 시',
            },
            bearish: {
                targets: [{ price: 95, basis: '지지선 이탈' }],
                condition: '100 이탈 시',
            },
        },
        patternSummaries: [],
        strategyResults: [],
        candlePatterns: [],
        trendlines: [],
    };

    beforeEach(() => {
        mockGenerateContent = jest.fn();
        mockGenerateContent.mockResolvedValue({
            text: JSON.stringify(mockAnalysisResponse),
        });
        (
            GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>
        ).mockImplementation(
            () =>
                ({
                    models: { generateContent: mockGenerateContent },
                }) as unknown as GoogleGenAI
        );
        provider = new GeminiProvider();
    });

    describe('GEMINI_API_KEY가 설정되지 않은 경우', () => {
        it('생성자를 호출하면 에러를 던진다', () => {
            const original = process.env.GEMINI_API_KEY;
            delete process.env.GEMINI_API_KEY;

            try {
                expect(() => new GeminiProvider()).toThrow(
                    'GEMINI_API_KEY must be set'
                );
            } finally {
                if (original === undefined) {
                    delete process.env.GEMINI_API_KEY;
                } else {
                    process.env.GEMINI_API_KEY = original;
                }
            }
        });
    });

    describe('analyze를 호출하면', () => {
        it('config에 temperature 0을 전달한다', async () => {
            await provider.analyze('test prompt');

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        temperature: 0,
                    }),
                })
            );
        });

        it('config에 topP 0.95를 전달한다', async () => {
            await provider.analyze('test prompt');

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        topP: 0.95,
                    }),
                })
            );
        });

        it('config에 responseMimeType application/json을 전달한다', async () => {
            await provider.analyze('test prompt');

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        responseMimeType: 'application/json',
                    }),
                })
            );
        });
    });

    describe('정상 입력으로 analyze를 호출하면', () => {
        it('AnalysisResponse 형태의 값을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('trend는 bullish | bearish | neutral 중 하나다', async () => {
            const result = await provider.analyze('test prompt');

            expect(['bullish', 'bearish', 'neutral']).toContain(result.trend);
        });

        it('riskLevel은 low | medium | high 중 하나다', async () => {
            const result = await provider.analyze('test prompt');

            expect(['low', 'medium', 'high']).toContain(result.riskLevel);
        });

        it('indicatorResults는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.indicatorResults)).toBe(true);
        });

        it('patternSummaries는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.patternSummaries)).toBe(true);
        });

        it('strategyResults는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.strategyResults)).toBe(true);
        });

        it('candlePatterns는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.candlePatterns)).toBe(true);
        });

        it('keyLevels.support와 keyLevels.resistance는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.keyLevels.support)).toBe(true);
            expect(Array.isArray(result.keyLevels.resistance)).toBe(true);
        });

        it('keyLevels 항목에 price와 reason이 포함된다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result.keyLevels.support[0]).toHaveProperty('price');
            expect(result.keyLevels.support[0]).toHaveProperty('reason');
            expect(result.keyLevels.resistance[0]).toHaveProperty('price');
            expect(result.keyLevels.resistance[0]).toHaveProperty('reason');
        });

        it('priceTargets에 bullish와 bearish 시나리오가 포함된다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result.priceTargets).toHaveProperty('bullish');
            expect(result.priceTargets).toHaveProperty('bearish');
            expect(Array.isArray(result.priceTargets.bullish.targets)).toBe(
                true
            );
            expect(Array.isArray(result.priceTargets.bearish.targets)).toBe(
                true
            );
        });

        it('priceTargets.bullish.targets 항목에 price와 basis 필드가 포함된다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result.priceTargets.bullish.targets[0]).toHaveProperty(
                'price'
            );
            expect(result.priceTargets.bullish.targets[0]).toHaveProperty(
                'basis'
            );
            expect(result.priceTargets.bearish.targets[0]).toHaveProperty(
                'price'
            );
            expect(result.priceTargets.bearish.targets[0]).toHaveProperty(
                'basis'
            );
        });

        it('priceTargets.bullish와 bearish에 condition 필드가 포함된다', async () => {
            const result = await provider.analyze('test prompt');

            expect(result.priceTargets.bullish).toHaveProperty('condition');
            expect(result.priceTargets.bearish).toHaveProperty('condition');
        });

        it('skillsDegraded 필드를 포함하지 않는다', async () => {
            const result = await provider.analyze('test prompt');

            expect('skillsDegraded' in result).toBe(false);
        });
    });

    describe('응답이 마크다운 코드 블록으로 감싸진 경우', () => {
        it('코드 블록을 제거하고 JSON을 파싱한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `\`\`\`json\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\``,
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('json 태그 없는 코드 블록도 처리한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `\`\`\`\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\``,
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('코드 블록 뒤에 후행 텍스트가 있어도 JSON을 파싱한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `\`\`\`json\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\`\n이상입니다.`,
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('코드 블록 앞에 설명 텍스트가 있어도 JSON을 파싱한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: `다음과 같습니다:\n\`\`\`json\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\``,
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });
    });

    describe('응답이 유효한 JSON이 아니면', () => {
        beforeEach(() => {
            mockGenerateContent.mockResolvedValue({ text: 'invalid json' });
        });

        it('에러를 던진다', async () => {
            await expect(provider.analyze('test prompt')).rejects.toThrow(
                'Failed to parse Gemini API response as JSON'
            );
        });

        it('console.error로 raw text를 기록한다', async () => {
            const consoleSpy = jest
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            try {
                await provider.analyze('test prompt').catch(() => {});
                expect(consoleSpy).toHaveBeenCalledWith(
                    'Failed to parse Gemini API response. Raw text:',
                    'invalid json'
                );
            } finally {
                consoleSpy.mockRestore();
            }
        });
    });

    describe('API 호출이 실패하면', () => {
        it('에러를 던진다', async () => {
            mockGenerateContent.mockRejectedValue(new Error('Network error'));

            await expect(provider.analyze('test prompt')).rejects.toThrow(
                'Network error'
            );
        });
    });

    describe('GEMINI_TEMPERATURE 환경변수 범위 검증', () => {
        it('범위를 벗어난 temperature(-1)이면 기본값 0을 사용한다', async () => {
            const originalTemp = process.env.GEMINI_TEMPERATURE;
            process.env.GEMINI_TEMPERATURE = '-1';

            let capturedTemperature: number | undefined;

            await jest.isolateModulesAsync(async () => {
                const { GeminiProvider: IsolatedProvider } =
                    await import('@/infrastructure/ai/gemini');
                mockGenerateContent.mockImplementation(
                    (params: { config: { temperature: number } }) => {
                        capturedTemperature = params.config.temperature;
                        return Promise.resolve({
                            text: JSON.stringify(mockAnalysisResponse),
                        });
                    }
                );
                const isolatedProvider = new IsolatedProvider();
                await isolatedProvider.analyze('test prompt');
            });

            if (originalTemp === undefined) {
                delete process.env.GEMINI_TEMPERATURE;
            } else {
                process.env.GEMINI_TEMPERATURE = originalTemp;
            }

            expect(capturedTemperature).toBe(0);
        });

        it('범위를 벗어난 top_p(0)이면 기본값 0.95를 사용한다', async () => {
            const originalTopP = process.env.GEMINI_TOP_P;
            process.env.GEMINI_TOP_P = '0';

            let capturedTopP: number | undefined;

            await jest.isolateModulesAsync(async () => {
                const { GeminiProvider: IsolatedProvider } =
                    await import('@/infrastructure/ai/gemini');
                mockGenerateContent.mockImplementation(
                    (params: { config: { topP: number } }) => {
                        capturedTopP = params.config.topP;
                        return Promise.resolve({
                            text: JSON.stringify(mockAnalysisResponse),
                        });
                    }
                );
                const isolatedProvider = new IsolatedProvider();
                await isolatedProvider.analyze('test prompt');
            });

            if (originalTopP === undefined) {
                delete process.env.GEMINI_TOP_P;
            } else {
                process.env.GEMINI_TOP_P = originalTopP;
            }

            expect(capturedTopP).toBe(0.95);
        });
    });
});
