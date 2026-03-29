import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiProvider } from '@/infrastructure/ai/gemini';
import type { AnalysisResponse } from '@/domain/types';

jest.mock('@google/generative-ai');

describe('GeminiProvider', () => {
    let mockGenerateContent: jest.Mock;
    let provider: GeminiProvider;

    const mockAnalysisResponse: AnalysisResponse = {
        summary: 'Test summary',
        trend: 'bullish',
        signals: [],
        skillSignals: [],
        riskLevel: 'low',
        keyLevels: { support: [100], resistance: [110] },
        patternSummaries: [],
        skillResults: [],
    };

    beforeEach(() => {
        mockGenerateContent = jest.fn();
        const mockGetGenerativeModel = jest.fn().mockReturnValue({
            generateContent: mockGenerateContent,
        });
        (
            GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>
        ).mockImplementation(
            () =>
                ({
                    getGenerativeModel: mockGetGenerativeModel,
                }) as unknown as GoogleGenerativeAI
        );
        provider = new GeminiProvider();
    });

    describe('GEMINI_API_KEY가 설정되지 않은 경우', () => {
        describe('생성자를 호출하면', () => {
            it('에러를 던진다', () => {
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
    });

    describe('정상 입력으로 analyze를 호출하면', () => {
        beforeEach(() => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => JSON.stringify(mockAnalysisResponse),
                },
            });
        });

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

        it('signals는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.signals)).toBe(true);
        });

        it('skillSignals는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.skillSignals)).toBe(true);
        });

        it('patternSummaries는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.patternSummaries)).toBe(true);
        });

        it('skillResults는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.skillResults)).toBe(true);
        });

        it('keyLevels.support와 keyLevels.resistance는 배열을 반환한다', async () => {
            const result = await provider.analyze('test prompt');

            expect(Array.isArray(result.keyLevels.support)).toBe(true);
            expect(Array.isArray(result.keyLevels.resistance)).toBe(true);
        });

        it('skillsDegraded 필드를 포함하지 않는다', async () => {
            const result = await provider.analyze('test prompt');

            expect('skillsDegraded' in result).toBe(false);
        });
    });

    describe('응답이 마크다운 코드 블록으로 감싸진 경우', () => {
        it('코드 블록을 제거하고 JSON을 파싱한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                response: {
                    text: () =>
                        `\`\`\`json\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\``,
                },
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });

        it('json 태그 없는 코드 블록도 처리한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                response: {
                    text: () =>
                        `\`\`\`\n${JSON.stringify(mockAnalysisResponse)}\n\`\`\``,
                },
            });

            const result = await provider.analyze('test prompt');

            expect(result).toEqual(mockAnalysisResponse);
        });
    });

    describe('응답이 유효한 JSON이 아니면', () => {
        beforeEach(() => {
            mockGenerateContent.mockResolvedValue({
                response: {
                    text: () => 'invalid json',
                },
            });
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
});
