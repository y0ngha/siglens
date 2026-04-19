import { chatAction } from '@/infrastructure/chat/chatAction';
import type { AnalysisResponse } from '@/domain/types';

jest.mock('next/headers', () => ({
    headers: jest.fn().mockResolvedValue({
        get: jest.fn((key: string) => {
            if (key === 'x-forwarded-for') return '1.2.3.4';
            return null;
        }),
    }),
}));

jest.mock('@/infrastructure/chat/tokenStore', () => ({
    hashIp: jest.fn(() => 'abc123hashedip'),
    tryConsumeToken: jest.fn(),
    getRemainingTokens: jest.fn(),
}));

jest.mock('@google/genai', () => ({
    GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
            generateContent: jest.fn(),
        },
    })),
}));

import { headers } from 'next/headers';
import { tryConsumeToken, getRemainingTokens } from '@/infrastructure/chat/tokenStore';
import { GoogleGenAI } from '@google/genai';

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockTryConsumeToken = tryConsumeToken as jest.MockedFunction<typeof tryConsumeToken>;
const mockGetRemainingTokens = getRemainingTokens as jest.MockedFunction<typeof getRemainingTokens>;
const MockGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

const MINIMAL_ANALYSIS: AnalysisResponse = {
    summary: 'AAPL trending up.',
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

describe('chatAction 함수는', () => {
    let mockGenerateContent: jest.Mock;

    beforeEach(() => {
        jest.resetAllMocks();
        process.env.GEMINI_API_KEY = 'paid-api-key';
        mockHeaders.mockResolvedValue({
            get: jest.fn((key: string) => {
                if (key === 'x-forwarded-for') return '1.2.3.4';
                return null;
            }),
        } as unknown as Awaited<ReturnType<typeof headers>>);
        mockGenerateContent = jest.fn();
        MockGoogleGenAI.mockImplementation(() => ({
            models: { generateContent: mockGenerateContent },
        }) as unknown as InstanceType<typeof GoogleGenAI>);
    });

    afterEach(() => {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_CHAT_FREE_API_KEY;
    });

    it('토큰 소진 시 token_exhausted 에러를 반환한다', async () => {
        mockTryConsumeToken.mockResolvedValueOnce(false);

        const result = await chatAction(
            'AAPL', '1Day', MINIMAL_ANALYSIS, [], '지금 사도 돼?'
        );

        expect(result).toEqual({ ok: false, error: 'token_exhausted' });
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('성공 시 AI 응답 메시지와 남은 토큰을 반환한다', async () => {
        mockTryConsumeToken.mockResolvedValueOnce(true);
        mockGetRemainingTokens.mockResolvedValueOnce(4);
        mockGenerateContent.mockResolvedValueOnce({ text: 'RSI가 높아서 조금 기다리는 게 좋아요.' });

        const result = await chatAction(
            'AAPL', '1Day', MINIMAL_ANALYSIS, [], '지금 사도 돼?'
        );

        expect(result).toEqual({
            ok: true,
            message: 'RSI가 높아서 조금 기다리는 게 좋아요.',
            remainingTokens: 4,
        });
    });

    it('GEMINI_CHAT_FREE_API_KEY 성공 시 paid key를 사용하지 않는다', async () => {
        process.env.GEMINI_CHAT_FREE_API_KEY = 'free-api-key';
        mockTryConsumeToken.mockResolvedValueOnce(true);
        mockGetRemainingTokens.mockResolvedValueOnce(3);

        let capturedApiKey = '';
        MockGoogleGenAI.mockImplementation((options: { apiKey?: string }) => {
            capturedApiKey = options.apiKey ?? '';
            return { models: { generateContent: mockGenerateContent } } as unknown as InstanceType<typeof GoogleGenAI>;
        });
        mockGenerateContent.mockResolvedValueOnce({ text: '응답' });

        await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(capturedApiKey).toBe('free-api-key');
    });

    it('GEMINI_CHAT_FREE_API_KEY 실패 시 paid key로 fallback한다', async () => {
        process.env.GEMINI_CHAT_FREE_API_KEY = 'free-api-key';
        mockTryConsumeToken.mockResolvedValueOnce(true);
        mockGetRemainingTokens.mockResolvedValueOnce(3);

        const usedKeys: string[] = [];
        MockGoogleGenAI.mockImplementation((options: { apiKey?: string }) => {
            usedKeys.push(options.apiKey ?? '');
            return { models: { generateContent: mockGenerateContent } } as unknown as InstanceType<typeof GoogleGenAI>;
        });
        // free key 실패, paid key 성공
        mockGenerateContent
            .mockRejectedValueOnce(new Error('free key quota exceeded'))
            .mockResolvedValueOnce({ text: 'paid key 응답' });

        const result = await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(usedKeys).toEqual(['free-api-key', 'paid-api-key']);
        expect(result).toEqual({ ok: true, message: 'paid key 응답', remainingTokens: 3 });
    });

    it('free key에서 429 에러 시 paid key로 fallback한다', async () => {
        process.env.GEMINI_CHAT_FREE_API_KEY = 'free-api-key';
        mockTryConsumeToken.mockResolvedValueOnce(true);
        mockGetRemainingTokens.mockResolvedValueOnce(3);

        const usedKeys: string[] = [];
        MockGoogleGenAI.mockImplementation((options: { apiKey?: string }) => {
            usedKeys.push(options.apiKey ?? '');
            return { models: { generateContent: mockGenerateContent } } as unknown as InstanceType<typeof GoogleGenAI>;
        });
        const rateLimitError = Object.assign(new Error('429'), { status: 429 });
        mockGenerateContent
            .mockRejectedValueOnce(rateLimitError)
            .mockResolvedValueOnce({ text: 'paid key fallback 응답' });

        const result = await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(usedKeys).toEqual(['free-api-key', 'paid-api-key']);
        expect(result).toEqual({ ok: true, message: 'paid key fallback 응답', remainingTokens: 3 });
    });

    it('GEMINI_API_KEY 미설정 시 server_error를 반환한다', async () => {
        delete process.env.GEMINI_API_KEY;
        mockTryConsumeToken.mockResolvedValueOnce(true);

        const result = await chatAction(
            'AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문'
        );

        expect(result).toEqual({ ok: false, error: 'server_error' });
        expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it('Gemini 429 에러 시 rate_limited를 반환한다', async () => {
        mockTryConsumeToken.mockResolvedValueOnce(true);
        const error = Object.assign(new Error('429'), { status: 429 });
        mockGenerateContent.mockRejectedValueOnce(error);

        const result = await chatAction(
            'AAPL', '1Day', MINIMAL_ANALYSIS, [], '언제 팔아?'
        );

        expect(result).toEqual({ ok: false, error: 'rate_limited' });
    });

    it('기타 Gemini 오류 시 server_error를 반환한다', async () => {
        mockTryConsumeToken.mockResolvedValueOnce(true);
        mockGenerateContent.mockRejectedValueOnce(new Error('network error'));

        const result = await chatAction(
            'AAPL', '1Day', MINIMAL_ANALYSIS, [], '설명해줘'
        );

        expect(result).toEqual({ ok: false, error: 'server_error' });
    });
});
