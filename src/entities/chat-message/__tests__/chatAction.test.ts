import type { MockedFunction, MockedClass, Mock } from 'vitest';
import { callAiProviderRouter } from '@/entities/llm-provider';
import { getCurrentUser } from '@/entities/session/lib/getCurrentUser';
import { chatAction } from '../actions/chatAction';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key';
import type {
    AnalysisResponse,
    ChatActionResult,
    CurrentAnalysisContext,
    FundamentalAnalysisResponse,
    LlmProvider,
} from '@y0ngha/siglens-core';
import {
    GEMINI_2_5_FLASH_MODEL,
    getProviderForModel,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

vi.mock('next/headers', () => ({
    headers: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return {
        ...actual,
        requestChatCompletion: vi.fn(),
        getProviderForModel: vi
            .fn()
            .mockImplementation(actual.getProviderForModel),
    };
});

vi.mock('@/entities/llm-provider', () => {
    // chatAction resolves the provider via getLlmProvider() (barrel re-export).
    // Outside E2E it returns callAiProviderRouter, so the mocked getLlmProvider
    // returns the same mocked router instance the assertions reference by
    // identity ({ callAiProvider: callAiProviderRouter }).
    const callAiProviderRouter = vi.fn();
    return {
        callAiProviderRouter,
        getLlmProvider: vi.fn(() => callAiProviderRouter),
    };
});

vi.mock('@/entities/session/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(),
}));

vi.mock('@/entities/api-key', () => ({
    DrizzleUserApiKeyRepository: vi.fn(),
}));

vi.mock('@/entities/user-tier', () => ({
    getUserTier: vi.fn().mockResolvedValue('free'),
}));

const mockHeaders = headers as MockedFunction<typeof headers>;
const mockRequestChatCompletion = requestChatCompletion as MockedFunction<
    typeof requestChatCompletion
>;
const mockGetCurrentUser = getCurrentUser as MockedFunction<
    typeof getCurrentUser
>;
const mockGetProviderForModel = getProviderForModel as MockedFunction<
    typeof getProviderForModel
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
        get: vi.fn((key: string) =>
            key === 'x-forwarded-for' ? (xForwardedFor ?? null) : null
        ),
    };
}

describe('chatAction 함수는', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        process.env.GEMINI_CHAT_API_KEY = 'gemini-server-key';
        delete process.env.ANTHROPIC_CHAT_API_KEY;
        delete process.env.OPENAI_CHAT_API_KEY;
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockRequestChatCompletion.mockResolvedValue(SUCCESS_RESULT);
        mockGetCurrentUser.mockResolvedValue(null);
        const actual = await vi.importActual<
            typeof import('@y0ngha/siglens-core')
        >('@y0ngha/siglens-core');
        mockGetProviderForModel.mockImplementation(actual.getProviderForModel);
    });

    afterEach(() => {
        delete process.env.GEMINI_CHAT_API_KEY;
        delete process.env.ANTHROPIC_CHAT_API_KEY;
        delete process.env.OPENAI_CHAT_API_KEY;
    });

    describe('Gemini 모델을 사용할 때', () => {
        it('free Gemini 모델은 GEMINI_CHAT_API_KEY를 serverApiKey로 전달한다', async () => {
            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '지금 사도 돼?',
                'gemini-2.5-flash'
            );

            expect(result).toBe(SUCCESS_RESULT);
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'gemini-server-key',
                    userApiKey: undefined,
                    model: 'gemini-2.5-flash',
                }),
                { callAiProvider: callAiProviderRouter }
            );
        });

    });

    describe('Anthropic 모델을 사용할 때', () => {
        it('free Anthropic 모델은 ANTHROPIC_CHAT_API_KEY를 serverApiKey로 전달한다', async () => {
            process.env.ANTHROPIC_CHAT_API_KEY = 'anthr-key';
            delete process.env.GEMINI_CHAT_API_KEY;

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'claude-haiku-4-5'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'anthr-key',
                    userApiKey: undefined,
                    model: 'claude-haiku-4-5',
                }),
                { callAiProvider: callAiProviderRouter }
            );
        });
    });

    describe('OpenAI 모델을 사용할 때', () => {
        it('free OpenAI 모델은 OPENAI_CHAT_API_KEY를 serverApiKey로 전달한다', async () => {
            process.env.OPENAI_CHAT_API_KEY = 'oai-key';
            delete process.env.GEMINI_CHAT_API_KEY;

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gpt-5-mini'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'oai-key',
                    userApiKey: undefined,
                    model: 'gpt-5-mini',
                }),
                { callAiProvider: callAiProviderRouter }
            );
        });
    });

    describe('서버 키가 없을 때', () => {
        it('Gemini 서버 primary key가 미설정이면 server_error를 반환하고 core를 호출하지 않는다', async () => {
            delete process.env.GEMINI_CHAT_API_KEY;

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });

        it('Anthropic 서버 primary key가 미설정이면 server_error를 반환하고 core를 호출하지 않는다', async () => {
            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'claude-haiku-4-5'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });

        it('OpenAI 서버 primary key가 미설정이면 server_error를 반환하고 core를 호출하지 않는다', async () => {
            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gpt-5-mini'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });
    });

    describe('premium 모델 + 사용자 API key 조회', () => {
        beforeEach(() => {
            process.env.ANTHROPIC_CHAT_API_KEY = 'anthr-key';
            delete process.env.GEMINI_CHAT_API_KEY;
        });

        it('premium 모델이고 로그인되지 않았으면 userApiKey를 undefined로 전달한다', async () => {
            mockGetCurrentUser.mockResolvedValue(null);

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'claude-opus-4-7'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'anthr-key',
                    userApiKey: undefined,
                }),
                expect.anything()
            );
        });

        it('premium 모델이고 로그인 + 사용자 키 등록이면 userApiKey로 사용자 키를 전달한다', async () => {
            const mockFindByUserAndProvider = vi
                .fn()
                .mockResolvedValue({ apiKey: 'user-personal-key' });
            (
                DrizzleUserApiKeyRepository as MockedClass<
                    typeof DrizzleUserApiKeyRepository
                >
            ).mockImplementation(function () {
                return {
                    findByUserAndProvider: mockFindByUserAndProvider,
                } as unknown as DrizzleUserApiKeyRepository;
            });
            (getDatabaseClient as Mock).mockReturnValue({ db: {} });
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as Awaited<
                ReturnType<typeof getCurrentUser>
            >);

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'claude-opus-4-7'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'anthr-key',
                    userApiKey: 'user-personal-key',
                }),
                expect.anything()
            );
            expect(getDatabaseClient).toHaveBeenCalled();
            expect(DrizzleUserApiKeyRepository).toHaveBeenCalledWith({});
            expect(mockFindByUserAndProvider).toHaveBeenCalledWith(
                'user-1',
                'anthropic'
            );
        });

        it('premium 모델이고 로그인했지만 키 미등록이면 userApiKey를 undefined로 전달한다', async () => {
            const mockFindByUserAndProvider = vi.fn().mockResolvedValue(null);
            (
                DrizzleUserApiKeyRepository as MockedClass<
                    typeof DrizzleUserApiKeyRepository
                >
            ).mockImplementation(function () {
                return {
                    findByUserAndProvider: mockFindByUserAndProvider,
                } as unknown as DrizzleUserApiKeyRepository;
            });
            (getDatabaseClient as Mock).mockReturnValue({ db: {} });
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as Awaited<
                ReturnType<typeof getCurrentUser>
            >);

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'claude-opus-4-7'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'anthr-key',
                    userApiKey: undefined,
                }),
                expect.anything()
            );
        });
    });

    describe('클라이언트 IP 처리', () => {
        it('x-forwarded-for에 여러 IP가 있으면 첫 번째 IP만 전달한다', async () => {
            mockHeaders.mockResolvedValue(
                makeHeadersMap('1.2.3.4, 5.6.7.8') as unknown as Awaited<
                    ReturnType<typeof headers>
                >
            );

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: '1.2.3.4' }),
                expect.anything()
            );
        });

        it('x-forwarded-for 헤더가 없으면 unknown을 전달한다', async () => {
            mockHeaders.mockResolvedValue(
                makeHeadersMap() as unknown as Awaited<
                    ReturnType<typeof headers>
                >
            );

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: 'unknown' }),
                expect.anything()
            );
        });

        it('headers() 조회가 실패하면 server_error를 반환한다', async () => {
            mockHeaders.mockRejectedValue(new Error('headers unavailable'));

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('에러 처리', () => {
        it('core use-case가 에러를 던지면 server_error를 반환한다', async () => {
            mockRequestChatCompletion.mockRejectedValue(
                new Error('core failed')
            );

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('기본 모델', () => {
        it('model을 생략하면 GEMINI_2_5_FLASH_MODEL을 core에 전달한다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    model: GEMINI_2_5_FLASH_MODEL,
                }),
                expect.objectContaining({
                    callAiProvider: callAiProviderRouter,
                })
            );
        });
    });

    describe('currentAnalysisContext 전달', () => {
        it('생략하면 core 호출에 currentAnalysisContext 키가 포함되지 않는다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );

            const params = mockRequestChatCompletion.mock.calls[0]![0];
            expect(params).not.toHaveProperty('currentAnalysisContext');
        });

        it('null로 전달하면 core 호출에 currentAnalysisContext 키가 포함되지 않는다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash',
                null
            );

            const params = mockRequestChatCompletion.mock.calls[0]![0];
            expect(params).not.toHaveProperty('currentAnalysisContext');
        });

        it('technical 컨텍스트는 그대로 core에 전달한다', async () => {
            const ctx: CurrentAnalysisContext = {
                kind: 'technical',
                payload: MINIMAL_ANALYSIS,
            };

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash',
                ctx
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ currentAnalysisContext: ctx }),
                expect.anything()
            );
        });

        it('fundamental 컨텍스트는 그대로 core에 전달한다', async () => {
            const fundamentalPayload: FundamentalAnalysisResponse = {
                overallSentiment: 'bullish',
                overallConclusionKo: 'AAPL 펀더멘털 양호.',
                categoryAssessments: [],
                riskFactorsKo: [],
            };
            const ctx: CurrentAnalysisContext = {
                kind: 'fundamental',
                payload: fundamentalPayload,
            };

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash',
                ctx
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ currentAnalysisContext: ctx }),
                expect.anything()
            );
        });
    });

    describe('알 수 없는 provider 처리', () => {
        it('알 수 없는 provider로 요청하면 server_error를 반환한다', async () => {
            mockGetProviderForModel.mockReturnValueOnce(
                'unknown' as unknown as LlmProvider
            );

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-2.5-flash'
            );
            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });
});
