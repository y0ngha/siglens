import { chatAction } from '@/infrastructure/chat/chatAction';
import {
    GEMINI_2_5_FLASH_LITE_MODEL,
    GEMINI_2_5_FLASH_MODEL,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import type { AnalysisResponse, ChatActionResult } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

jest.mock('next/headers', () => ({
    headers: jest.fn(),
}));

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    GEMINI_2_5_FLASH_MODEL: 'gemini-2.5-flash',
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    VALID_CHAT_MODELS: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    requestChatCompletion: jest.fn(),
}));

const mockHeaders = headers as jest.MockedFunction<typeof headers>;
const mockRequestChatCompletion = requestChatCompletion as jest.MockedFunction<
    (params: unknown) => Promise<ChatActionResult>
>;

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

const SUCCESS_RESULT: ChatActionResult = {
    ok: true,
    message: 'RSI가 높아서 조금 기다리는 게 좋아요.',
    remainingTokens: 4,
};

function makeHeadersMap(xForwardedFor?: string) {
    return {
        get: jest.fn((key: string) =>
            key === 'x-forwarded-for' ? (xForwardedFor ?? null) : null
        ),
    };
}

describe('chatAction 함수는', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.GEMINI_API_KEY = 'paid-api-key';
        delete process.env.GEMINI_CHAT_FREE_API_KEY;
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockRequestChatCompletion.mockResolvedValue(SUCCESS_RESULT);
    });

    afterEach(() => {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GEMINI_CHAT_FREE_API_KEY;
    });

    it('core 채팅 use-case에 요청 정보를 위임하고 결과를 반환한다', async () => {
        const history = [{ role: 'user' as const, content: '이전 질문' }];

        const result = await chatAction(
            'AAPL',
            '1Day',
            MINIMAL_ANALYSIS,
            history,
            '지금 사도 돼?',
            GEMINI_2_5_FLASH_LITE_MODEL
        );

        expect(result).toBe(SUCCESS_RESULT);
        expect(mockRequestChatCompletion).toHaveBeenCalledWith({
            clientIp: '1.2.3.4',
            symbol: 'AAPL',
            timeframe: '1Day',
            analysis: MINIMAL_ANALYSIS,
            history,
            userMessage: '지금 사도 돼?',
            model: GEMINI_2_5_FLASH_LITE_MODEL,
            freeApiKey: undefined,
            paidApiKey: 'paid-api-key',
        });
    });

    it('model을 생략하면 core의 기본 채팅 모델을 전달한다', async () => {
        await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(mockRequestChatCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                model: GEMINI_2_5_FLASH_MODEL,
            })
        );
    });

    it('free API key가 있으면 core use-case에 함께 전달한다', async () => {
        process.env.GEMINI_CHAT_FREE_API_KEY = 'free-api-key';

        await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(mockRequestChatCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                freeApiKey: 'free-api-key',
                paidApiKey: 'paid-api-key',
            })
        );
    });

    it('x-forwarded-for에 여러 IP가 있으면 첫 번째 IP만 전달한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4, 5.6.7.8') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );

        await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(mockRequestChatCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                clientIp: '1.2.3.4',
            })
        );
    });

    it('x-forwarded-for 헤더가 없으면 unknown을 전달한다', async () => {
        mockHeaders.mockResolvedValue(
            makeHeadersMap() as unknown as Awaited<ReturnType<typeof headers>>
        );

        await chatAction('AAPL', '1Day', MINIMAL_ANALYSIS, [], '질문');

        expect(mockRequestChatCompletion).toHaveBeenCalledWith(
            expect.objectContaining({
                clientIp: 'unknown',
            })
        );
    });

    it('GEMINI_API_KEY 미설정 시 server_error를 반환한다', async () => {
        delete process.env.GEMINI_API_KEY;

        const result = await chatAction(
            'AAPL',
            '1Day',
            MINIMAL_ANALYSIS,
            [],
            '질문'
        );

        expect(result).toEqual({ ok: false, error: 'server_error' });
        expect(mockRequestChatCompletion).not.toHaveBeenCalled();
    });

    it('headers 조회 실패 시 server_error를 반환한다', async () => {
        mockHeaders.mockRejectedValue(new Error('headers unavailable'));

        const result = await chatAction(
            'AAPL',
            '1Day',
            MINIMAL_ANALYSIS,
            [],
            '질문'
        );

        expect(result).toEqual({ ok: false, error: 'server_error' });
    });

    it('core use-case가 에러를 던지면 server_error를 반환한다', async () => {
        mockRequestChatCompletion.mockRejectedValue(new Error('core failed'));

        const result = await chatAction(
            'AAPL',
            '1Day',
            MINIMAL_ANALYSIS,
            [],
            '질문'
        );

        expect(result).toEqual({ ok: false, error: 'server_error' });
    });
});
