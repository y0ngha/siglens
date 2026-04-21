import { translateCompanyNames } from '@/infrastructure/ticker/koreanTranslator';
import { GoogleGenAI } from '@google/genai';
import { stripMarkdownCodeBlock } from '@/infrastructure/ai/utils';

const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: { generateContent: mockGenerateContent },
    })),
}));

jest.mock('@/infrastructure/ai/utils', () => ({
    stripMarkdownCodeBlock: jest.fn((text: string) => text),
}));

const mockStripMarkdown = stripMarkdownCodeBlock as jest.Mock;
const MockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('translateCompanyNames', () => {
    beforeEach(() => {
        process.env.TRANSLATE_API_KEY = 'test-key';
        delete process.env.TRANSLATE_FREE_API_KEY;
        jest.clearAllMocks();
        mockStripMarkdown.mockImplementation((text: string) => text);
        MockedGoogleGenAI.mockImplementation(
            () =>
                ({
                    models: { generateContent: mockGenerateContent },
                }) as unknown as GoogleGenAI
        );
    });

    afterEach(() => {
        delete process.env.TRANSLATE_API_KEY;
        delete process.env.TRANSLATE_MODEL;
        delete process.env.TRANSLATE_FREE_API_KEY;
    });

    describe('빈 배열을 전달할 때', () => {
        it('빈 객체를 반환한다', async () => {
            const result = await translateCompanyNames([]);
            expect(result).toEqual({});
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('TRANSLATE_API_KEY가 없을 때', () => {
        it('빈 객체를 반환한다', async () => {
            delete process.env.TRANSLATE_API_KEY;
            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);
            expect(result).toEqual({});
            expect(mockGenerateContent).not.toHaveBeenCalled();
        });
    });

    describe('API 호출이 성공할 때', () => {
        it('번역된 한국어 이름 맵을 반환한다', async () => {
            const mockResponse = JSON.stringify({
                AAPL: '애플',
                NVDA: '엔비디아',
            });
            mockGenerateContent.mockResolvedValueOnce({ text: mockResponse });

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
                { symbol: 'NVDA', name: 'NVIDIA Corp.' },
            ]);

            expect(result).toEqual({ AAPL: '애플', NVDA: '엔비디아' });
        });
    });

    describe('TRANSLATE_MODEL 환경변수가 설정되었을 때', () => {
        it('해당 모델을 사용한다', async () => {
            process.env.TRANSLATE_MODEL = 'gemini-2.0-flash';
            const mockResponse = JSON.stringify({ AAPL: '애플' });
            mockGenerateContent.mockResolvedValueOnce({ text: mockResponse });

            await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gemini-2.0-flash' })
            );
        });
    });

    describe('TRANSLATE_MODEL 환경변수가 없을 때', () => {
        it('기본 모델(gemini-2.5-flash)을 사용한다', async () => {
            const mockResponse = JSON.stringify({ AAPL: '애플' });
            mockGenerateContent.mockResolvedValueOnce({ text: mockResponse });

            await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(mockGenerateContent).toHaveBeenCalledWith(
                expect.objectContaining({ model: 'gemini-2.5-flash' })
            );
        });
    });

    describe('TRANSLATE_FREE_API_KEY가 설정된 경우', () => {
        it('무료 키로 먼저 호출한다', async () => {
            process.env.TRANSLATE_FREE_API_KEY = 'free-key';
            const freeGenerateContent = jest.fn().mockResolvedValue({
                text: JSON.stringify({ AAPL: '애플' }),
            });
            let callCount = 0;
            MockedGoogleGenAI.mockImplementation(
                () =>
                    ({
                        models: {
                            generateContent:
                                callCount++ === 0
                                    ? freeGenerateContent
                                    : mockGenerateContent,
                        },
                    }) as unknown as GoogleGenAI
            );

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(freeGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent).not.toHaveBeenCalled();
            expect(result).toEqual({ AAPL: '애플' });
        });

        it('무료 키 실패 시 유료 키로 전환한다', async () => {
            process.env.TRANSLATE_FREE_API_KEY = 'free-key';
            const freeGenerateContent = jest
                .fn()
                .mockRejectedValue(new Error('quota exceeded'));
            let callCount = 0;
            MockedGoogleGenAI.mockImplementation(
                () =>
                    ({
                        models: {
                            generateContent:
                                callCount++ === 0
                                    ? freeGenerateContent
                                    : mockGenerateContent,
                        },
                    }) as unknown as GoogleGenAI
            );
            mockGenerateContent.mockResolvedValueOnce({
                text: JSON.stringify({ AAPL: '애플' }),
            });

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(freeGenerateContent).toHaveBeenCalledTimes(1);
            expect(mockGenerateContent).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ AAPL: '애플' });
        });
    });

    describe('API 응답이 마크다운 코드 블록을 포함할 때', () => {
        it('stripMarkdownCodeBlock을 호출하여 정리한다', async () => {
            const wrappedResponse = '```json\n{"AAPL":"애플"}\n```';
            mockStripMarkdown.mockReturnValueOnce('{"AAPL":"애플"}');
            mockGenerateContent.mockResolvedValueOnce({
                text: wrappedResponse,
            });

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(mockStripMarkdown).toHaveBeenCalledWith(wrappedResponse);
            expect(result).toEqual({ AAPL: '애플' });
        });
    });

    describe('API 호출이 실패할 때', () => {
        it('빈 객체를 반환한다', async () => {
            mockGenerateContent.mockRejectedValueOnce(new Error('API error'));

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({});
        });
    });

    describe('API가 유효하지 않은 JSON을 반환할 때', () => {
        it('빈 객체를 반환한다', async () => {
            mockGenerateContent.mockResolvedValueOnce({
                text: 'invalid json response',
            });

            const result = await translateCompanyNames([
                { symbol: 'AAPL', name: 'Apple Inc.' },
            ]);

            expect(result).toEqual({});
        });
    });
});
