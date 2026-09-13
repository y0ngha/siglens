import type { MockedFunction, MockedClass, Mock } from 'vitest';
import { callAiProviderRouter } from '@/entities/llm-provider';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { chatAction } from '../actions/chatAction';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleUserApiKeyRepository } from '@/entities/api-key/api';
import type {
    AnalysisResponse,
    ChatActionResult,
    CurrentAnalysisContext,
    FundamentalAnalysisResponse,
    LlmProvider,
} from '@y0ngha/siglens-core';
import {
    createCounterStore,
    DEEPSEEK_V4_1_FLASH_MODEL,
    getProviderForModel,
    requestChatCompletion,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getOrCreateGuestId } from '@/shared/api/guestId';

const GUEST_ID = '11111111-1111-1111-1111-111111111111';

// Guest backstop's counter store — defaults to "allowed" so every existing
// test (all guest by default; see `mockGetCurrentUser`) keeps passing.
// Refusal/outage paths override `mockConsume` per-test. Hoisted since both
// are referenced inside `vi.mock` factories below, which vitest hoists
// above this file's own top-level statements.
const { mockConsume } = vi.hoisted(() => ({
    mockConsume: vi.fn().mockResolvedValue(true),
}));

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
        createCounterStore: vi.fn(() => ({
            consume: mockConsume,
            refund: vi.fn(),
            remaining: vi.fn(),
        })),
    };
});

vi.mock('@/shared/api/guestId', () => ({
    getOrCreateGuestId: vi
        .fn()
        .mockResolvedValue('11111111-1111-1111-1111-111111111111'),
}));

vi.mock('@/entities/llm-provider', async () => {
    // chatAction resolves the provider via getLlmProvider() (barrel re-export).
    // Outside E2E it returns callAiProviderRouter, so the mocked getLlmProvider
    // returns the same mocked router instance the assertions reference by
    // identity ({ callAiProvider: callAiProviderRouter }).
    const callAiProviderRouter = vi.fn();
    // getServerPrimaryKey moved to lib/serverKeys — import the real
    // implementation (not the whole barrel, to avoid loading SDK adapters)
    // so this mock can't drift from the source of truth. Tests set
    // *_CHAT_API_KEY directly and expect it forwarded via real env lookup.
    const { getServerPrimaryKey } = await vi.importActual<
        typeof import('@/entities/llm-provider/lib/serverKeys')
    >('@/entities/llm-provider/lib/serverKeys');
    return {
        callAiProviderRouter,
        getLlmProvider: vi.fn(() => callAiProviderRouter),
        getServerPrimaryKey,
    };
});

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(),
}));

vi.mock('@/entities/api-key/api', () => ({
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
const mockCreateCounterStore = createCounterStore as MockedFunction<
    typeof createCounterStore
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
        delete process.env.DEEPSEEK_CHAT_API_KEY;
        mockHeaders.mockResolvedValue(
            makeHeadersMap('1.2.3.4') as unknown as Awaited<
                ReturnType<typeof headers>
            >
        );
        mockRequestChatCompletion.mockResolvedValue(SUCCESS_RESULT);
        mockGetCurrentUser.mockResolvedValue(null);
        mockConsume.mockResolvedValue(true);
        (
            getOrCreateGuestId as MockedFunction<typeof getOrCreateGuestId>
        ).mockResolvedValue(GUEST_ID);
        const actual = await vi.importActual<
            typeof import('@y0ngha/siglens-core')
        >('@y0ngha/siglens-core');
        mockGetProviderForModel.mockImplementation(actual.getProviderForModel);
    });

    afterEach(() => {
        delete process.env.GEMINI_CHAT_API_KEY;
        delete process.env.ANTHROPIC_CHAT_API_KEY;
        delete process.env.OPENAI_CHAT_API_KEY;
        delete process.env.DEEPSEEK_CHAT_API_KEY;
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
                'gemini-3.6-flash'
            );

            expect(result).toBe(SUCCESS_RESULT);
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'gemini-server-key',
                    userApiKey: undefined,
                    model: 'gemini-3.6-flash',
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
                'gpt-5.6-luna'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'oai-key',
                    userApiKey: undefined,
                    model: 'gpt-5.6-luna',
                }),
                { callAiProvider: callAiProviderRouter }
            );
        });
    });

    describe('DeepSeek 모델을 사용할 때', () => {
        it('free DeepSeek 모델은 DEEPSEEK_CHAT_API_KEY를 serverApiKey로 전달한다', async () => {
            process.env.DEEPSEEK_CHAT_API_KEY = 'deepseek-key';
            delete process.env.GEMINI_CHAT_API_KEY;

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'deepseek-v4.1-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'deepseek-key',
                    userApiKey: undefined,
                    model: 'deepseek-v4.1-flash',
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
                'gemini-3.6-flash'
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
                'gpt-5.6-luna'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });

        it('DeepSeek 서버 primary key가 미설정이면 server_error를 반환하고 core를 호출하지 않는다', async () => {
            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'deepseek-v4.1-flash'
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
                'claude-opus-5'
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
                'claude-opus-5'
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
                'claude-opus-5'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: 'anthr-key',
                    userApiKey: undefined,
                }),
                expect.anything()
            );
        });

        /**
         * 서버 키는 우리가 비용을 부담할 때만 필요하다. BYOK로 결제하는 non-pro
         * 사용자의 premium 요청은 서버 키 유무와 무관하므로, 서버 키가 없다는
         * 이유로 막히면 안 된다 — 이전 구현은 tier를 알기도 전에 이 검사를 해서
         * 그런 요청을 전부 `server_error`로 떨어뜨렸다.
         */
        it('서버 chat 키가 없어도 non-pro premium 요청은 core로 넘긴다 (BYOK 경로)', async () => {
            delete process.env.ANTHROPIC_CHAT_API_KEY;
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
                'claude-opus-5'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({
                    serverApiKey: undefined,
                    userApiKey: 'user-personal-key',
                }),
                expect.anything()
            );
        });
    });

    describe('클라이언트 IP 처리(게스트 IP 백스탑 입력값)', () => {
        // core로 넘어가는 `clientIp`는 더 이상 raw IP가 아니라 방문자 키
        // (`클라이언트 방문자 키(clientKey) 처리` 참고) — 여기서는 raw IP가
        // 여전히 게스트 IP 백스탑의 입력으로 쓰이는지만 확인한다.
        it('x-forwarded-for에 여러 IP가 있어도 백스탑을 통과하면 게스트 키로 core를 호출한다', async () => {
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
                'gemini-3.6-flash'
            );

            expect(mockConsume).toHaveBeenCalledTimes(1);
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: `guest:${GUEST_ID}` }),
                expect.anything()
            );
        });

        it('x-forwarded-for 헤더가 없어도 백스탑을 통과하면 게스트 키로 core를 호출한다', async () => {
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
                'gemini-3.6-flash'
            );

            expect(mockConsume).toHaveBeenCalledTimes(1);
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: `guest:${GUEST_ID}` }),
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
                'gemini-3.6-flash'
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
                'gemini-3.6-flash'
            );

            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('기본 모델', () => {
        it('model을 생략하면 DEEPSEEK_V4_1_FLASH_MODEL을 core에 전달한다', async () => {
            process.env.DEEPSEEK_CHAT_API_KEY = 'deepseek-server-key';

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
                    model: DEEPSEEK_V4_1_FLASH_MODEL,
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
                'gemini-3.6-flash'
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
                'gemini-3.6-flash',
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
                'gemini-3.6-flash',
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
                'gemini-3.6-flash',
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
                'gemini-3.6-flash'
            );
            expect(result).toEqual({ ok: false, error: 'server_error' });
        });
    });

    describe('assetClass forwarding', () => {
        it('assetClass 생략 시 기본값 "equity"가 requestChatCompletion에 전달된다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'equity' }),
                expect.anything()
            );
        });

        it('assetClass: "crypto"로 전달하면 requestChatCompletion에 그대로 전달된다', async () => {
            await chatAction(
                'BTCUSD',
                'Bitcoin',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash',
                null,
                'crypto'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ assetClass: 'crypto' }),
                expect.anything()
            );
        });
    });

    describe('currency forwarding', () => {
        it('forwards currency: "USD" for a US symbol', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ currency: 'USD' }),
                expect.anything()
            );
        });

        it('forwards currency: "KRW" for a KR symbol', async () => {
            await chatAction(
                '005930.KS',
                '삼성전자',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ currency: 'KRW' }),
                expect.anything()
            );
        });
    });

    describe('클라이언트 방문자 키(clientKey) 처리', () => {
        it('게스트 턴에서 IP 백스탑 카운터를 chat 전용 prefix로 생성한다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(mockCreateCounterStore).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'chat:q:guest-ip',
                    period: 'day',
                    failurePolicy: 'closed',
                })
            );
        });

        it('게스트는 `guest:<쿠키 id>`를 clientIp로 전달하고 IP 백스탑을 거친다', async () => {
            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(getOrCreateGuestId).toHaveBeenCalled();
            expect(mockConsume).toHaveBeenCalledTimes(1);
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: `guest:${GUEST_ID}` }),
                expect.anything()
            );
        });

        it('로그인한 회원은 `user:<userId>`를 clientIp로 전달하고 IP 백스탑을 건너뛴다', async () => {
            mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as Awaited<
                ReturnType<typeof getCurrentUser>
            >);
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

            await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(getOrCreateGuestId).not.toHaveBeenCalled();
            expect(mockConsume).not.toHaveBeenCalled();
            expect(mockRequestChatCompletion).toHaveBeenCalledWith(
                expect.objectContaining({ clientIp: 'user:user-1' }),
                expect.anything()
            );
        });
    });

    describe('게스트 IP 백스탑', () => {
        it('백스탑 소진 시 core를 호출하지 않고 token_exhausted를 반환한다(클라이언트가 현지화 문구로 표시)', async () => {
            mockConsume.mockResolvedValueOnce(false);

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(result).toEqual({ ok: false, error: 'token_exhausted' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });

        it('카운터 스토어 장애 시 server_busy를 반환한다(fail-closed)', async () => {
            const { CounterStoreUnavailableError } = await vi.importActual<
                typeof import('@y0ngha/siglens-core')
            >('@y0ngha/siglens-core');
            mockConsume.mockRejectedValueOnce(
                new CounterStoreUnavailableError('chat:q:guest-ip')
            );

            const result = await chatAction(
                'AAPL',
                'Apple Inc.',
                '1Day',
                MINIMAL_ANALYSIS,
                [],
                '질문',
                'gemini-3.6-flash'
            );

            expect(result).toEqual({ ok: false, error: 'server_busy' });
            expect(mockRequestChatCompletion).not.toHaveBeenCalled();
        });
    });
});
