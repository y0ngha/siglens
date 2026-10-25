import * as Anthropic from '@anthropic-ai/sdk';
import * as OpenAI from 'openai';

const m = vi.hoisted(() => ({
    overall: vi.fn(),
    news: vi.fn(),
    options: vi.fn(),
    findKey: vi.fn(),
    findDefaultModel: vi.fn(),
    consume: vi.fn(),
    findRecentForPrompt: vi.fn(async (): Promise<unknown[]> => []),
    findMarketEventsForPrompt: vi.fn(async (): Promise<unknown[]> => []),
    listEarningsDates: vi.fn(
        async (): Promise<readonly string[] | undefined> => undefined
    ),
    resolveHoldingPositionBucket: vi.fn(
        async (): Promise<string | undefined> => undefined
    ),
}));

interface CoreCall {
    cacheOnly: boolean;
    model: string;
    tier: string;
    providerFallback: unknown;
    keyPolicy: string | undefined;
    userApiKey: string | undefined;
    /** core가 LLM에 실제로 쓸 키. 서버 키를 골랐다면 env 값. 캐시 확인만 한 호출은 `null`. */
    keyUsedForLlm: string | null;
    /** core `runAnalysis`가 받은 이 회사의 실적 발표일. */
    earningsDates: readonly string[] | undefined;
}
const serverKeys = vi.hoisted(() => ({ getServerPrimaryKey: vi.fn() }));
const core = vi.hoisted(() => ({
    cache: null as object | null,
    fresh: { summary: 'fresh', trend: 'bullish' } as object,
    failWith: null as unknown,
    /** 있으면 생성 호출이 이 promise가 풀릴 때까지 기다린다. */
    deferred: null as Promise<object> | null,
    /** true면 signal이 abort될 때 생성 호출이 AbortError로 reject된다. */
    abortable: false,
    signals: [] as AbortSignal[],
    /** 확인(cacheOnly) 호출이 미스로 끝나는 순간 불린다. */
    onProbe: null as (() => void) | null,
    calls: [] as CoreCall[],
}));

/*
 * core의 `runAnalysis`를 키 정책(core 2.18.0 `keyPolicy`)까지 흉내 내는 가짜로 바꾼다. 실제 규칙은
 * core의 `shouldUseServerKey`·`isUserApiKeyGateDeniedAt`(domain/keyRouting.js, application/byok/gate.js):
 *  - `keyPolicy: 'byok-only'`: 모델 등급·tier와 무관하게 서버 키를 고르지 않고, 키 게이트가 캐시 조회와
 *    `skipEnqueueIfMiss`의 `miss_no_trigger` **뒤**에 있어 캐시 적중은 키 없이 돌려준다.
 *  - 기본 정책(`tier`): 진짜 `requiresByokKey`로 판정하고 게이트가 캐시 조회 **앞**이다(웹 경로, 바뀌지 않았다).
 * 서버 키를 고르면 `getServerPrimaryKey`(서버 env 경로)를 부른다 — byok-only에서는 불리면 안 된다.
 */
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    type Tier = Parameters<typeof actual.requiresByokKey>[0];
    type Model = Parameters<typeof actual.requiresByokKey>[1];
    return {
        ...actual,
        runAnalysis: async (
            _symbol: string,
            _name: string,
            _timeframe: string,
            _force: boolean,
            _fmp: string | undefined,
            options: {
                modelId: Model;
                tierContext: { tier: Tier };
                skipEnqueueIfMiss?: boolean;
                userApiKey?: string;
                keyPolicy?: string;
                providerFallback?: unknown;
                signal?: AbortSignal;
                earningsDates?: readonly string[];
            }
        ) => {
            if (options.signal !== undefined) core.signals.push(options.signal);
            const byokOnly =
                options.keyPolicy !== undefined && options.keyPolicy !== 'tier';
            const serverKeyChosen =
                !byokOnly &&
                !actual.requiresByokKey(
                    options.tierContext.tier,
                    options.modelId
                );
            const record: CoreCall = {
                cacheOnly: options.skipEnqueueIfMiss === true,
                model: options.modelId,
                tier: options.tierContext.tier,
                providerFallback: options.providerFallback,
                keyPolicy: options.keyPolicy,
                userApiKey: options.userApiKey,
                keyUsedForLlm: null,
                earningsDates: options.earningsDates,
            };
            core.calls.push(record);
            const keyMissing =
                options.userApiKey === undefined || options.userApiKey === '';
            // 기본 정책의 게이트: 캐시 조회 앞.
            if (!byokOnly && !serverKeyChosen && keyMissing)
                return { status: 'key_error', code: 'user_api_key_required' };
            if (core.cache !== null)
                return { status: 'cached', result: core.cache };
            if (options.skipEnqueueIfMiss) {
                core.onProbe?.();
                return { status: 'miss_no_trigger' };
            }
            // byok-only의 게이트: 캐시 조회·miss_no_trigger 뒤.
            if (byokOnly && keyMissing)
                return { status: 'key_error', code: 'user_api_key_required' };
            if (serverKeyChosen)
                serverKeys.getServerPrimaryKey(
                    actual.getProviderForModel(options.modelId)
                );
            record.keyUsedForLlm = serverKeyChosen
                ? (process.env.ANTHROPIC_API_KEY ?? 'SERVER-KEY')
                : (options.userApiKey ?? null);
            if (core.failWith !== null) throw core.failWith;
            if (core.deferred !== null) {
                const pending = core.deferred;
                const fresh = await (core.abortable && options.signal
                    ? Promise.race([
                          pending,
                          new Promise<never>((_, reject) =>
                              options.signal?.addEventListener(
                                  'abort',
                                  () => reject(new Error('aborted')),
                                  { once: true }
                              )
                          ),
                      ])
                    : pending);
                return { status: 'done', result: fresh };
            }
            return { status: 'done', result: core.fresh };
        },
    };
});
vi.mock('@/entities/llm-provider/lib/serverKeys', () => ({
    getServerPrimaryKey: serverKeys.getServerPrimaryKey,
}));
vi.mock('@/entities/analysis/server/overallAnalysisRunner', () => ({
    executeOverallAnalysis: m.overall,
}));
vi.mock('@/entities/news-article/server/newsAnalysisRunner', () => ({
    executeNewsAnalysis: m.news,
}));
vi.mock('@/entities/options-chain/server/optionsAnalysisRunner', () => ({
    executeOptionsAnalysis: m.options,
}));
vi.mock('@/entities/api-key/api', async importOriginal => ({
    ...(await importOriginal<typeof import('@/entities/api-key/api')>()),
    DrizzleUserApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findByUserAndProvider: m.findKey };
    }),
}));
vi.mock('@/entities/siglens-api-key/api', () => ({
    DrizzleSiglensApiKeyRepository: vi.fn().mockImplementation(function () {
        return { findApiDefaultModel: m.findDefaultModel };
    }),
}));
vi.mock('@/entities/siglens-api-key/server/rateLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/siglens-api-key/server/rateLimit')
    >('@/entities/siglens-api-key/server/rateLimit');
    return { ...actual, consumeRateLimit: m.consume };
});
// runFreshAnalysis.ts(에이전트 구현)가 끌어오는 의존. 이 테스트는 그 모듈의 unwrap·슬롯만 쓴다.
vi.mock('@/entities/analysis/actions/runOverallAnalysisAction', () => ({
    runOverallAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/news-article/actions/submitNewsAnalysisAction', () => ({
    submitNewsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/options-chain/actions/optionsActions', () => ({
    submitOptionsAnalysisAction: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: vi.fn(async () => 'us-equity'),
}));
vi.mock('@/entities/ticker/lib/resolveKrxTickTable', () => ({
    resolveKrxTickTable: vi.fn().mockResolvedValue('share'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: vi.fn(async () => ({ name: 'Apple', fmpSymbol: 'AAPL' })),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(() => ({ tag: 'session' })),
}));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    getDescriptor: () => ({
        assetClass: 'equity',
        priceFormat: { currency: 'USD' },
    }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
vi.mock('@/entities/analysis/analysisHistoryRepository', () => ({
    DrizzleAnalysisHistoryRepository: vi.fn(function () {
        return { findRecentForPrompt: m.findRecentForPrompt };
    }),
}));
vi.mock('@/entities/earnings-report/api', () => ({
    listEarningsDates: m.listEarningsDates,
}));
vi.mock('@/entities/news-article/marketEventsRepository', () => ({
    findMarketEventsForPrompt: m.findMarketEventsForPrompt,
}));
vi.mock('@/entities/news-article/lib/marketEventsLookback', () => ({
    marketEventsLookback: vi.fn(() => ({
        from: new Date('2026-06-01T00:00:00Z'),
        to: new Date('2026-08-01T00:00:00Z'),
    })),
}));
vi.mock('@/entities/portfolio/lib/resolveHoldingPositionBucket', () => ({
    resolveHoldingPositionBucket: m.resolveHoldingPositionBucket,
}));

import { prepareRunner } from '@/app/api/v1/freshAnalysisRunner';
import { runByokFreshAnalysis } from '@/app/api/v1/runByokFreshAnalysis';
import { UserApiKeyMissingError, type ModelId } from '@y0ngha/siglens-core';
import {
    __resetFreshSemaphoreForTests,
    tryAcquireFreshSlot,
} from '@/app/api/ai/chat/tools/runFreshAnalysis';
import { isPublicToolStream } from '@/app/api/v1/publicToolOutcome';
import { RateLimiterUnavailableError } from '@/entities/siglens-api-key/server/rateLimit';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { ByokOnlyRoutingError } from '@/shared/lib/byokOnly';
import { PUBLIC_API_RATE_LIMITS } from '@/shared/config/publicApi';
import {
    __activeStreamCount,
    __resetActiveStreamsForTests,
} from '@/shared/lib/sse/activeStreams';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const USER_ANTHROPIC_KEY = 'sk-ant-USER-OWN-KEY';
const OTHER_USERS_KEY = 'sk-ant-SOMEONE-ELSES-KEY';
/** 서버 env에 있는 키 — 어떤 경로로도 core에 닿으면 안 된다. */
const SERVER_ENV_KEYS = {
    ANTHROPIC_API_KEY: 'SERVER-ENV-anthropic',
    ANTHROPIC_CHAT_API_KEY: 'SERVER-ENV-anthropic-chat',
    OPENAI_API_KEY: 'SERVER-ENV-openai',
    OPENAI_CHAT_API_KEY: 'SERVER-ENV-openai-chat',
    GEMINI_API_KEY: 'SERVER-ENV-gemini',
    GEMINI_CHAT_API_KEY: 'SERVER-ENV-gemini-chat',
    DEEPSEEK_API_KEY: 'SERVER-ENV-deepseek',
    DEEPSEEK_CHAT_API_KEY: 'SERVER-ENV-deepseek-chat',
} as const;

const BYOK_MODEL = 'claude-opus-5';
const MEMBER_MODEL = 'claude-sonnet-5-5';
const FREE_MODEL = 'claude-haiku-5-5';

const principal = (tier: ApiKeyPrincipal['tier'] = 'pro'): ApiKeyPrincipal => ({
    keyId: 'key-1',
    keyName: 'agent',
    keyPrefix: 'slk_abcdef',
    userId: USER_ID,
    tier,
});

const allowedVerdict = {
    allowed: true,
    window: 'minute' as const,
    limit: PUBLIC_API_RATE_LIMITS.ai.perMinute,
    remaining: 9,
    resetAtEpochSeconds: 1_792_000_020,
    retryAfterSeconds: 20,
};

/** 생성이 시작되면 `{ streaming, completion }`이 온다 — 대부분의 테스트는 최종 결과만 본다. */
function runRaw(
    args: Record<string, unknown> = {},
    tier: ApiKeyPrincipal['tier'] = 'pro',
    signal: AbortSignal = new AbortController().signal
) {
    return runByokFreshAnalysis({
        args: { symbol: 'AAPL', kind: 'technical', ...args },
        principal: principal(tier),
        locale: 'en',
        signal,
    });
}

async function run(
    args: Record<string, unknown> = {},
    tier: ApiKeyPrincipal['tier'] = 'pro',
    signal?: AbortSignal
) {
    const result = await runRaw(args, tier, signal);
    return isPublicToolStream(result) ? result.completion : result;
}

/** 사용자 키가 등록돼 있다(본인 userId로 조회될 때만). */
function registerUserKey(provider = 'anthropic', apiKey = USER_ANTHROPIC_KEY) {
    m.findKey.mockImplementation(async (userId: string, p: string) =>
        userId === USER_ID && p === provider ? { apiKey } : null
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const [name, value] of Object.entries(SERVER_ENV_KEYS))
        vi.stubEnv(name, value);
    core.cache = null;
    core.fresh = { summary: 'fresh', trend: 'bullish' };
    core.failWith = null;
    core.deferred = null;
    core.onProbe = null;
    core.abortable = false;
    core.signals.length = 0;
    core.calls.length = 0;
    serverKeys.getServerPrimaryKey.mockReset();
    m.findKey.mockResolvedValue(null);
    m.findDefaultModel.mockResolvedValue(null);
    m.consume.mockResolvedValue(allowedVerdict);
    __resetFreshSemaphoreForTests();
    __resetActiveStreamsForTests();
});
afterEach(() => vi.unstubAllEnvs());

describe('모델 결정', () => {
    it('model 인자도 기본 모델도 없으면 400 model_required이고 core도 한도도 건드리지 않는다', async () => {
        const result = await run();
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'model_required',
        });
        expect(core.calls).toHaveLength(0);
        expect(m.consume).not.toHaveBeenCalled();
        expect(m.findDefaultModel).toHaveBeenCalledWith(USER_ID);
    });

    it('인자가 없으면 users.api_default_model을 쓴다', async () => {
        m.findDefaultModel.mockResolvedValue(BYOK_MODEL);
        core.cache = { summary: 'cached' };
        const result = await run();
        expect(result).toMatchObject({
            ok: true,
            meta: { source: 'cache', model: BYOK_MODEL },
        });
        expect(core.calls[0].model).toBe(BYOK_MODEL);
    });

    it('인자가 기본 모델을 이긴다(기본 모델은 읽지도 않는다)', async () => {
        m.findDefaultModel.mockResolvedValue(BYOK_MODEL);
        core.cache = { summary: 'cached' };
        await run({ model: 'gpt-6-astra' });
        expect(core.calls[0].model).toBe('gpt-6-astra');
        expect(m.findDefaultModel).not.toHaveBeenCalled();
    });

    it('로스터에 없는 model 인자는 400 invalid_model', async () => {
        const result = await run({ model: 'gpt-99-imaginary' });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'invalid_model',
        });
        expect(core.calls).toHaveLength(0);
    });

    it('저장된 기본 모델이 로스터에서 사라졌으면 400 invalid_model', async () => {
        m.findDefaultModel.mockResolvedValue('retired-model');
        const result = await run();
        expect(result).toMatchObject({ ok: false, code: 'invalid_model' });
        expect(core.calls).toHaveLength(0);
    });

    it('기본 모델 조회가 실패하면 503이다(model_required로 오인시키지 않는다)', async () => {
        m.findDefaultModel.mockRejectedValue(new Error('db down'));
        const result = await run();
        expect(result).toMatchObject({
            ok: false,
            status: 503,
            code: 'service_unavailable',
        });
    });

    it('잘못된 심볼은 400 invalid_symbol', async () => {
        const result = await run({ symbol: '??!', model: BYOK_MODEL });
        expect(result).toMatchObject({ ok: false, code: 'invalid_symbol' });
    });
});

describe('공유 캐시 적중 — LLM 미호출, ai 한도 미소비', () => {
    beforeEach(() => {
        core.cache = { summary: 'cached', trend: 'bullish' };
    });

    it('등록된 키가 없어도 캐시를 돌려준다(source: cache) — core에는 byok-only로, 키 없이 보낸다', async () => {
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: true,
            meta: { source: 'cache', model: BYOK_MODEL },
        });
        expect(core.calls).toHaveLength(1);
        expect(core.calls[0]).toMatchObject({
            cacheOnly: true,
            keyUsedForLlm: null,
            keyPolicy: 'byok-only',
        });
        expect(core.calls[0].userApiKey).toBeUndefined();
        expect(m.consume).not.toHaveBeenCalled();
    });

    it.each([
        ['byok 등급', BYOK_MODEL],
        ['member 등급', MEMBER_MODEL],
        ['free 등급', FREE_MODEL],
    ])(
        '%s 모델도 키 없이 캐시 적중을 받는다(200 source: cache, 키 없이 byok-only)',
        async (_label, model) => {
            const result = await run({ model });
            expect(result).toMatchObject({
                ok: true,
                meta: { source: 'cache', model },
            });
            expect(core.calls).toHaveLength(1);
            expect(core.calls[0]).toMatchObject({
                cacheOnly: true,
                keyPolicy: 'byok-only',
                keyUsedForLlm: null,
            });
            expect(core.calls[0].userApiKey).toBeUndefined();
            expect(m.consume).not.toHaveBeenCalled();
            expect(serverKeys.getServerPrimaryKey).not.toHaveBeenCalled();
        }
    );

    it('키가 있으면 확인 호출에도 그 키를 쓰고 LLM은 부르지 않는다', async () => {
        registerUserKey();
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({ ok: true, meta: { source: 'cache' } });
        expect(core.calls).toHaveLength(1);
        expect(core.calls[0]).toMatchObject({
            cacheOnly: true,
            keyPolicy: 'byok-only',
            userApiKey: USER_ANTHROPIC_KEY,
            keyUsedForLlm: null,
        });
        expect(m.consume).not.toHaveBeenCalled();
    });

    it('키 저장소 장애여도 캐시 적중은 키 없이 돌려준다(미스일 때만 503)', async () => {
        m.findKey.mockRejectedValue(new Error('key store down'));
        const result = await run({ model: FREE_MODEL });
        expect(result).toMatchObject({
            ok: true,
            meta: { source: 'cache', model: FREE_MODEL },
        });
        expect(core.calls[0].userApiKey).toBeUndefined();
    });

    it('키 저장소 장애 + 캐시 미스는 503이다(키 없음으로 오인시키지 않는다)', async () => {
        core.cache = null;
        m.findKey.mockRejectedValue(new Error('key store down'));
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 503,
            code: 'service_unavailable',
        });
        expect(m.consume).not.toHaveBeenCalled();
    });

    it('응답 data는 get_cached_analysis와 같은 봉투다', async () => {
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: true,
            data: { found: true, source: 'cached', tab: 'technical' },
        });
    });
});

describe('캐시 미스', () => {
    it('키가 없으면 400 byok_key_required { provider }이고 ai 한도를 소비하지 않는다', async () => {
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
        expect(m.consume).not.toHaveBeenCalled();
        // 확인 호출 한 번뿐 — 생성 호출은 없다.
        expect(core.calls).toHaveLength(1);
        expect(core.calls[0].cacheOnly).toBe(true);
        expect(core.calls.some(call => call.keyUsedForLlm !== null)).toBe(
            false
        );
    });

    it.each([
        ['claude-opus-5', 'anthropic'],
        ['gpt-6-astra', 'openai'],
        ['gemini-4-argon', 'google'],
    ])('%s의 키가 없으면 provider는 %s', async (model, provider) => {
        const result = await run({ model });
        expect(result).toMatchObject({
            code: 'byok_key_required',
            details: { provider },
        });
    });

    it('다른 provider의 키만 있으면 그 모델에는 쓰지 않는다', async () => {
        registerUserKey('openai', 'sk-openai-key');
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
        expect(core.calls.every(call => call.keyUsedForLlm === null)).toBe(
            true
        );
    });

    it('저장된 키를 복호화하지 못하면 다시 등록하라는 byok_key_required', async () => {
        const { LlmApiKeyDecryptionFailedError } =
            await import('@/entities/api-key/api');
        m.findKey.mockRejectedValue(
            new LlmApiKeyDecryptionFailedError(USER_ID, 'anthropic')
        );
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            code: 'byok_key_required',
            message: expect.stringContaining('could not be read'),
        });
    });

    it('키 조회 DB 오류는 503이다(키 없음으로 오인시키지 않는다)', async () => {
        m.findKey.mockRejectedValue(new Error('db down'));
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({ ok: false, status: 503 });
    });

    it('free 등급 모델도 키가 없으면 400 byok_key_required { provider }이고 ai 한도를 소비하지 않는다', async () => {
        const result = await run({ model: FREE_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
        expect(m.consume).not.toHaveBeenCalled();
        expect(core.calls.every(call => call.cacheOnly)).toBe(true);
        expect(core.calls.some(call => call.keyUsedForLlm !== null)).toBe(
            false
        );
        expect(serverKeys.getServerPrimaryKey).not.toHaveBeenCalled();
    });

    it.each([
        ['free 등급', FREE_MODEL],
        ['member 등급', MEMBER_MODEL],
    ])(
        '%s 모델은 사용자 키로 생성하고 core에 byok-only를 넘기며 서버 키 경로를 읽지 않는다',
        async (_label, model) => {
            registerUserKey();
            const result = await run({ model }, 'member');

            expect(result).toMatchObject({
                ok: true,
                meta: { source: 'fresh', model },
            });
            expect(m.consume).toHaveBeenCalledWith(USER_ID, 'ai');
            const generation = core.calls.find(call => !call.cacheOnly);
            expect(generation).toMatchObject({
                model,
                keyPolicy: 'byok-only',
                userApiKey: USER_ANTHROPIC_KEY,
                keyUsedForLlm: USER_ANTHROPIC_KEY,
            });
            for (const call of core.calls)
                expect(call.keyPolicy).toBe('byok-only');
            expect(serverKeys.getServerPrimaryKey).not.toHaveBeenCalled();
            expect(Object.values(SERVER_ENV_KEYS)).not.toContain(
                generation?.keyUsedForLlm
            );
        }
    );

    it('core가 UserApiKeyMissingError를 던져도 500이 아니라 400 byok_key_required다', async () => {
        registerUserKey();
        core.failWith = new UserApiKeyMissingError();
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
        expect(console.error).not.toHaveBeenCalledWith(
            expect.stringContaining('failed'),
            expect.anything()
        );
    });

    describe('키가 있으면 사용자 키로 만든다', () => {
        beforeEach(() => registerUserKey());

        it('ai 버킷을 회원 단위로 소비하고 사용자 키로 생성한다(source: fresh)', async () => {
            const result = await run({ model: BYOK_MODEL });

            expect(result).toMatchObject({
                ok: true,
                meta: { source: 'fresh', model: BYOK_MODEL },
                data: { source: 'fresh', found: true },
            });
            expect(m.consume).toHaveBeenCalledTimes(1);
            expect(m.consume).toHaveBeenCalledWith(USER_ID, 'ai');
            const generation = core.calls.find(call => !call.cacheOnly);
            expect(generation?.keyUsedForLlm).toBe(USER_ANTHROPIC_KEY);
            expect(generation?.userApiKey).toBe(USER_ANTHROPIC_KEY);
        });

        it('이 회사의 실적 발표일을 조회해 core 기술 분석에 넘긴다', async () => {
            m.listEarningsDates.mockResolvedValue(['2026-07-30']);

            await run({ model: BYOK_MODEL });

            expect(m.listEarningsDates).toHaveBeenCalledWith(
                expect.any(String),
                expect.anything()
            );
            expect(
                core.calls.every(c => c.earningsDates?.[0] === '2026-07-30')
            ).toBe(true);
            expect(core.calls.length).toBeGreaterThan(0);
        });

        it('서버 키 env가 전부 있어도 어떤 core 호출도 그 값을 쓰지 않는다', async () => {
            await run({ model: BYOK_MODEL });

            const serverValues = Object.values(SERVER_ENV_KEYS) as string[];
            expect(core.calls.length).toBeGreaterThanOrEqual(2);
            for (const call of core.calls) {
                expect(serverValues).not.toContain(call.keyUsedForLlm);
                expect(serverValues).not.toContain(call.userApiKey);
            }
        });

        it.each(['free', 'member', 'pro'] as const)(
            '%s 회원은 실제 tier 그대로 넘기고 byok-only로 사용자 키를 쓴다(tier로 키를 고르지 않는다)',
            async tier => {
                await run({ model: BYOK_MODEL }, tier);
                expect(core.calls.map(call => call.tier)).toEqual([tier, tier]);
                expect(core.calls.map(call => call.keyPolicy)).toEqual([
                    'byok-only',
                    'byok-only',
                ]);
                expect(
                    core.calls.find(call => !call.cacheOnly)?.keyUsedForLlm
                ).toBe(USER_ANTHROPIC_KEY);
                expect(serverKeys.getServerPrimaryKey).not.toHaveBeenCalled();
            }
        );

        it('기술 분석은 providerFallback을 켜지 않는다(실패해도 서버 Gemini 키로 재시도하지 않는다)', async () => {
            await run({ model: BYOK_MODEL });
            for (const call of core.calls)
                expect(call.providerFallback).toBeUndefined();
        });

        it('생성 중 분석 슬롯을 쓰고 끝나면 반납한다', async () => {
            await run({ model: BYOK_MODEL });
            expect(__activeStreamCount()).toBe(0);
        });

        it('생성 도중 다른 호출이 먼저 캐시를 채웠으면 source: cache로 답한다', async () => {
            let probes = 0;
            core.calls.length = 0;
            const original = core.cache;
            // 첫 호출(확인)은 미스, 두 번째(생성)는 적중.
            Object.defineProperty(core, 'cache', {
                configurable: true,
                get: () => (probes++ === 0 ? null : { summary: 'raced' }),
                set: () => {},
            });
            try {
                const result = await run({ model: BYOK_MODEL });
                expect(result).toMatchObject({
                    ok: true,
                    meta: { source: 'cache' },
                });
            } finally {
                Object.defineProperty(core, 'cache', {
                    configurable: true,
                    writable: true,
                    value: original,
                });
            }
        });
    });

    it('IDOR: 다른 회원의 키가 저장소에 있어도 쓰지 않는다 — 조회는 인증된 회원 id로만', async () => {
        m.findKey.mockImplementation(async (userId: string) =>
            userId === OTHER_USER_ID ? { apiKey: OTHER_USERS_KEY } : null
        );

        const result = await run({ model: BYOK_MODEL });

        expect(result).toMatchObject({ code: 'byok_key_required' });
        for (const [userId] of m.findKey.mock.calls)
            expect(userId).toBe(USER_ID);
        for (const call of core.calls) {
            expect(call.userApiKey).not.toBe(OTHER_USERS_KEY);
            expect(call.keyUsedForLlm).not.toBe(OTHER_USERS_KEY);
        }
    });

    it('args에 userId·apiKey를 실어도 소유 회원 키 조회에 영향이 없다', async () => {
        registerUserKey();
        await run({
            model: BYOK_MODEL,
            userId: OTHER_USER_ID,
            apiKey: OTHER_USERS_KEY,
        });
        for (const [userId] of m.findKey.mock.calls)
            expect(userId).toBe(USER_ID);
        expect(core.calls.find(call => !call.cacheOnly)?.keyUsedForLlm).toBe(
            USER_ANTHROPIC_KEY
        );
    });
});

describe('ai 버킷', () => {
    beforeEach(() => registerUserKey());

    it('분당 한도 초과는 429 + ai 버킷 헤더·Retry-After이고 생성하지 않는다', async () => {
        m.consume.mockResolvedValue({
            ...allowedVerdict,
            allowed: false,
            remaining: 0,
            retryAfterSeconds: 17,
        });
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 429,
            code: 'rate_limited',
            message: expect.stringContaining('ai bucket'),
            headers: {
                'X-RateLimit-AI-Limit': String(
                    PUBLIC_API_RATE_LIMITS.ai.perMinute
                ),
                'X-RateLimit-AI-Remaining': '0',
                'X-RateLimit-AI-Reset': String(
                    allowedVerdict.resetAtEpochSeconds
                ),
                'Retry-After': '17',
            },
        });
        // 접두 없는 X-RateLimit-*는 data 버킷 몫이라 싣지 않는다.
        expect(
            Object.keys((result as { headers: object }).headers)
        ).not.toContain('X-RateLimit-Limit');
        expect(core.calls.some(call => !call.cacheOnly)).toBe(false);
    });

    it('확인 호출 뒤 생성 시작 전에 끊기면 슬롯도 ai 한도도 쓰지 않고 생성하지 않는다', async () => {
        const controller = new AbortController();
        // 확인 호출이 끝나는 순간 요청이 끊긴 상황.
        core.onProbe = () => controller.abort();
        const result = await run(
            { model: BYOK_MODEL },
            'pro',
            controller.signal
        );

        expect(result).toMatchObject({
            ok: false,
            status: 504,
            code: 'aborted',
        });
        expect(m.consume).not.toHaveBeenCalled();
        expect(core.calls.filter(call => !call.cacheOnly)).toHaveLength(0);
        expect(__activeStreamCount()).toBe(0);
    });

    it('한도 저장소 장애는 503 rate_limiter_unavailable이고 생성하지 않는다(fail-open 금지)', async () => {
        m.consume.mockRejectedValue(new RateLimiterUnavailableError());
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 503,
            code: 'rate_limiter_unavailable',
        });
        expect(core.calls.some(call => !call.cacheOnly)).toBe(false);
    });

    it('분석 슬롯이 가득 차면 503 busy이고 한도를 소비하지 않는다', async () => {
        const held = Array.from({ length: 10 }, () => tryAcquireFreshSlot());
        expect(held.every(release => release !== null)).toBe(true);
        try {
            const result = await run({ model: BYOK_MODEL });
            expect(result).toMatchObject({
                ok: false,
                status: 503,
                code: 'busy',
                headers: { 'Retry-After': '60' },
            });
            expect(m.consume).not.toHaveBeenCalled();
        } finally {
            held.forEach(release => release?.());
        }
    });

    it('한도 거절 뒤에도 슬롯은 반납된다', async () => {
        m.consume.mockResolvedValue({
            ...allowedVerdict,
            allowed: false,
            remaining: 0,
        });
        await run({ model: BYOK_MODEL });
        expect(__activeStreamCount()).toBe(0);
    });
});

describe('provider 오류 → 502 provider_error', () => {
    beforeEach(() => registerUserKey());
    const HEADERS = new Headers();

    it('사용자 키 거절(401)은 provider와 상태를 알려 준다', async () => {
        core.failWith = new Anthropic.AuthenticationError(
            401,
            undefined,
            'invalid x-api-key',
            HEADERS
        );
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 502,
            code: 'provider_error',
            details: { provider: 'anthropic', status: 401 },
        });
    });

    it('provider 한도(429)도 상태를 알려 준다', async () => {
        core.failWith = new Anthropic.RateLimitError(
            429,
            undefined,
            'slow down',
            HEADERS
        );
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            status: 502,
            details: { provider: 'anthropic', status: 429 },
        });
    });

    it('OpenAI 모델이면 provider는 openai', async () => {
        registerUserKey('openai', 'sk-openai-user');
        core.failWith = new OpenAI.APIError(
            403,
            undefined,
            'no access',
            HEADERS
        );
        const result = await run({ model: 'gpt-6-astra' });
        expect(result).toMatchObject({
            status: 502,
            details: { provider: 'openai', status: 403 },
        });
    });

    it('core가 재시도를 소진한 sentinel은 status: null', async () => {
        core.failWith = new Error('AI_SERVER_UNSTABLE');
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            status: 502,
            code: 'provider_error',
            details: { provider: 'anthropic', status: null },
        });
    });

    it('provider 탓이 아닌 오류는 500 tool_failed이고 내부 문구를 싣지 않는다', async () => {
        core.failWith = new Error('connection string postgres://secret');
        const result = await run({ model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 500,
            code: 'tool_failed',
        });
        expect(JSON.stringify(result)).not.toContain('secret');
    });

    it('오류 뒤에도 슬롯을 반납한다', async () => {
        core.failWith = new Error('boom');
        await run({ model: BYOK_MODEL });
        expect(__activeStreamCount()).toBe(0);
    });
});

/** 각 종류의 `unwrap`이 읽는 필드를 갖춘 최소 결과. */
const RESULT_BY_KIND: Record<string, object> = {
    overall: {
        headlineKo: 'h',
        technicalBulletsKo: [],
        fundamentalBulletsKo: [],
        newsBulletsKo: [],
        optionsBulletsKo: [],
        integratedConclusionKo: 'c',
        scenarios: [],
        riskFactorsKo: [],
    },
    news: { currentDriverKo: 'd', keyEventsKo: [] },
    options: { summary: 's', signals: [], perExpiration: [] },
};

describe('종류별 실행', () => {
    beforeEach(() => {
        registerUserKey();
        m.overall.mockResolvedValue({ status: 'miss_no_trigger' });
        m.news.mockResolvedValue({ status: 'miss_no_trigger' });
        m.options.mockResolvedValue({ status: 'miss_no_trigger' });
    });

    it.each([
        ['overall', () => m.overall],
        ['news', () => m.news],
        ['options', () => m.options],
    ])(
        '%s는 사용자 키·BYOK 전용 호출자로 확인 → 생성한다',
        async (kind, pick) => {
            const runner = pick();
            runner
                .mockResolvedValueOnce({ status: 'miss_no_trigger' })
                .mockResolvedValueOnce({
                    status: 'done',
                    result: RESULT_BY_KIND[kind],
                });

            const result = await run({ kind, model: BYOK_MODEL }, 'pro');

            expect(result).toMatchObject({
                ok: true,
                meta: { source: 'fresh' },
            });
            expect(runner).toHaveBeenCalledTimes(2);
            const [probe, generation] = runner.mock.calls.map(c => c[0]);
            expect(probe).toMatchObject({
                symbol: 'AAPL',
                modelId: BYOK_MODEL,
                locale: 'en',
            });
            // tier는 회원의 실제 값 그대로다(pro도 member로 내리지 않는다).
            expect(probe.caller).toMatchObject({
                userId: USER_ID,
                tier: 'pro',
                byokOnly: true,
                userApiKey: USER_ANTHROPIC_KEY,
            });
            expect(generation.caller).toMatchObject({
                userId: USER_ID,
                tier: 'pro',
                byokOnly: true,
                userApiKey: USER_ANTHROPIC_KEY,
            });
            const isCacheOnly = (call: {
                cacheOnly?: boolean;
                options?: { cacheOnly?: boolean };
            }) => call.cacheOnly ?? call.options?.cacheOnly;
            expect(isCacheOnly(probe)).toBe(true);
            expect(isCacheOnly(generation)).toBe(false);
            expect(m.consume).toHaveBeenCalledWith(USER_ID, 'ai');
        }
    );

    it('options는 가장 가까운 만기가 아니라 all을 쓴다(에이전트와 같은 캐시 키)', async () => {
        await run({ kind: 'options', model: BYOK_MODEL });
        expect(m.options.mock.calls[0][0].expirationDate).toBe('all');
    });

    it('overall은 에이전트와 같은 이력 입력을 넘기고, 확인·생성이 한 번 읽은 이력을 같이 쓴다', async () => {
        m.overall
            .mockResolvedValueOnce({ status: 'miss_no_trigger' })
            .mockResolvedValueOnce({
                status: 'done',
                result: RESULT_BY_KIND.overall,
            });
        await run({ kind: 'overall', model: BYOK_MODEL, timeframe: '1Hour' });

        expect(m.overall).toHaveBeenCalledTimes(2);
        const [probe, generation] = m.overall.mock.calls.map(c => c[0]);
        expect(probe.timeframe).toBe('1Hour');
        expect(probe.options).toMatchObject({
            reasoning: false,
            cacheOnly: true,
        });
        expect(generation.options.cacheOnly).toBe(false);
        // technical 축 + overall 축, 각 한 번.
        expect(m.findRecentForPrompt).toHaveBeenCalledTimes(2);
        expect(generation.options.priorAnalyses).toBe(
            probe.options.priorAnalyses
        );
    });

    it('키가 없으면 확인 호출은 키 없이 byok 전용 호출자로 보내고 생성은 하지 않는다', async () => {
        m.findKey.mockResolvedValue(null);
        const result = await run({ kind: 'news', model: BYOK_MODEL });
        expect(result).toMatchObject({ code: 'byok_key_required' });
        expect(m.news).toHaveBeenCalledTimes(1);
        const [probe] = m.news.mock.calls.map(c => c[0]);
        expect(probe.caller).toMatchObject({ byokOnly: true });
        expect(probe.caller.userApiKey).toBeUndefined();
        expect(probe.cacheOnly).toBe(true);
        expect(m.consume).not.toHaveBeenCalled();
    });

    it.each([
        ['news', () => m.news],
        ['options', () => m.options],
    ])(
        '%s: 키 없이 캐시 적중이면 200 source: cache이다(core가 키 게이트 전에 돌려준다)',
        async (kind, pick) => {
            m.findKey.mockResolvedValue(null);
            pick().mockResolvedValue({
                status: 'cached',
                result: RESULT_BY_KIND[kind],
            });
            const result = await run({ kind, model: BYOK_MODEL });
            expect(result).toMatchObject({
                ok: true,
                meta: { source: 'cache' },
            });
            expect(m.consume).not.toHaveBeenCalled();
            expect(pick()).toHaveBeenCalledWith(
                expect.objectContaining({
                    modelId: BYOK_MODEL,
                    cacheOnly: true,
                    caller: expect.not.objectContaining({
                        userApiKey: expect.anything(),
                    }),
                })
            );
        }
    );

    it('overall: 키 없이 캐시 적중이면 200 source: cache이고 키 없는 byok 전용 호출자로 확인한다', async () => {
        m.findKey.mockResolvedValue(null);
        m.overall.mockResolvedValue({
            status: 'cached',
            result: RESULT_BY_KIND.overall,
        });
        const result = await run({ kind: 'overall', model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: true,
            meta: { source: 'cache', model: BYOK_MODEL },
        });
        expect(m.consume).not.toHaveBeenCalled();
        expect(m.overall).toHaveBeenCalledTimes(1);
        expect(m.overall).toHaveBeenCalledWith(
            expect.objectContaining({
                modelId: BYOK_MODEL,
                options: expect.objectContaining({ cacheOnly: true }),
                caller: expect.objectContaining({ byokOnly: true }),
            })
        );
        expect(m.overall).not.toHaveBeenCalledWith(
            expect.objectContaining({
                caller: expect.objectContaining({
                    userApiKey: expect.anything(),
                }),
            })
        );
    });

    it('overall: 키 없이 미스면 400 byok_key_required이고 ai 한도를 소비하지 않는다', async () => {
        m.findKey.mockResolvedValue(null);
        m.overall.mockResolvedValue({ status: 'miss_no_trigger' });
        const result = await run({ kind: 'overall', model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
        expect(m.consume).not.toHaveBeenCalled();
        expect(m.overall).toHaveBeenCalledTimes(1);
    });

    it('생성 호출이 key_error를 돌려주면 422 analysis_failed가 아니라 400 byok_key_required이다', async () => {
        m.news
            .mockResolvedValueOnce({ status: 'miss_no_trigger' })
            .mockResolvedValueOnce({
                status: 'key_error',
                code: 'user_api_key_required',
                error: 'key required',
            });
        const result = await run({ kind: 'news', model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            details: { provider: 'anthropic' },
        });
    });

    it('news 생성 중 core가 UserApiKeyMissingError를 던져도 400 byok_key_required다', async () => {
        m.news
            .mockResolvedValueOnce({ status: 'miss_no_trigger' })
            .mockRejectedValueOnce(new UserApiKeyMissingError());
        const result = await run({ kind: 'news', model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 400,
            code: 'byok_key_required',
        });
    });

    it('core가 분석을 만들지 못한 상태는 422 analysis_failed + 원인 코드', async () => {
        m.news.mockResolvedValue({
            status: 'error',
            code: 'no_news',
            error: 'No news to analyze',
        });
        const result = await run({ kind: 'news', model: BYOK_MODEL });
        expect(result).toMatchObject({
            ok: false,
            status: 422,
            code: 'analysis_failed',
            details: { code: 'no_news' },
        });
        expect(m.consume).not.toHaveBeenCalled();
    });

    it('서버 키를 쓰는 에이전트 구현(runFreshAnalysisTool)은 부르지 않는다', async () => {
        const agentModule =
            await import('@/entities/analysis/actions/runOverallAnalysisAction');
        await run({ kind: 'overall', model: BYOK_MODEL });
        expect(agentModule.runOverallAnalysisAction).not.toHaveBeenCalled();
    });
});

describe('스트리밍 경계 — 사전 검사를 모두 통과한 생성만 스트림이다', () => {
    beforeEach(() => registerUserKey());

    it('생성은 { streaming: true, completion }을 돌려주고 완료까지 슬롯을 쥔다', async () => {
        let finish: (value: object) => void = () => undefined;
        core.deferred = new Promise(resolve => (finish = resolve));
        const raw = await runRaw({ model: BYOK_MODEL });

        expect(isPublicToolStream(raw)).toBe(true);
        // 반환 시점에는 생성이 진행 중이고 슬롯·한도는 이미 잡혔다.
        expect(m.consume).toHaveBeenCalledWith(USER_ID, 'ai');
        expect(__activeStreamCount()).toBe(1);

        finish({ summary: 'late' });
        if (!isPublicToolStream(raw)) throw new Error('expected stream');
        await expect(raw.completion).resolves.toMatchObject({
            ok: true,
            meta: { source: 'fresh' },
        });
        expect(__activeStreamCount()).toBe(0);
    });

    it('캐시 적중은 스트림이 아니다', async () => {
        core.cache = { summary: 'cached' };
        expect(isPublicToolStream(await runRaw({ model: BYOK_MODEL }))).toBe(
            false
        );
    });

    it.each([
        ['model_required', {}, (): void => undefined],
        ['byok_key_required', { model: 'gpt-6-astra' }, (): void => undefined],
        [
            'rate_limited',
            { model: BYOK_MODEL },
            (): void => {
                m.consume.mockResolvedValue({
                    ...allowedVerdict,
                    allowed: false,
                    remaining: 0,
                });
            },
        ],
    ])(
        '사전 거절(%s)은 스트림이 아니라 일반 결과다',
        async (code, args, arrange) => {
            arrange();
            const raw = await runRaw(args);
            expect(isPublicToolStream(raw)).toBe(false);
            expect(raw).toMatchObject({ ok: false, code });
        }
    );

    it('요청 끊김을 공유 생성(core)에 넘기지 않는다 — 생성은 끝까지 돌고, 끝난 뒤 슬롯을 반납한다', async () => {
        // core `dedupeInFlight`는 같은 캐시 키의 생성을 사이트·에이전트·다른 API 호출과 공유한다.
        // 이 요청의 끊김이 core까지 가면 그 공유 생성을 기다리던 다른 사용자의 분석이 실패한다.
        const controller = new AbortController();
        let finish: (value: object) => void = () => undefined;
        core.deferred = new Promise(resolve => (finish = resolve));
        core.abortable = true;
        const raw = await runRaw(
            { model: BYOK_MODEL },
            'pro',
            controller.signal
        );
        if (!isPublicToolStream(raw)) throw new Error('expected stream');

        controller.abort();
        const generationSignal = core.signals.at(-1);
        expect(generationSignal).toBeDefined();
        expect(generationSignal).not.toBe(controller.signal);
        expect(generationSignal?.aborted).toBe(false);
        // 생성이 아직 도는 동안 슬롯은 잡혀 있다(동시 실행 상한이 거짓말하지 않게).
        expect(__activeStreamCount()).toBe(1);

        finish({ summary: 'fresh', trend: 'bullish' });
        await expect(raw.completion).resolves.toMatchObject({ ok: true });
        expect(__activeStreamCount()).toBe(0);
    });
});

describe('ai 버킷 상태 헤더', () => {
    beforeEach(() => registerUserKey());

    it('생성 스트림은 소비한 ai 버킷 상태를 X-RateLimit-AI-*로 싣는다', async () => {
        const raw = await runRaw({ model: BYOK_MODEL });
        if (!isPublicToolStream(raw)) throw new Error('expected stream');
        expect(raw.headers).toEqual({
            'X-RateLimit-AI-Limit': String(PUBLIC_API_RATE_LIMITS.ai.perMinute),
            'X-RateLimit-AI-Remaining': String(allowedVerdict.remaining),
            'X-RateLimit-AI-Reset': String(allowedVerdict.resetAtEpochSeconds),
        });
        await raw.completion;
    });

    it('캐시 적중은 ai 버킷을 읽지 않으므로 그 헤더도 없다', async () => {
        core.cache = { summary: 'cached' };
        const result = await run({ model: BYOK_MODEL });
        expect(result).not.toHaveProperty('headers');
        expect(m.consume).not.toHaveBeenCalled();
    });
});

describe('끊김·마감 뒤에도 생성 오류는 오류 자체로 분류되고 기록된다', () => {
    beforeEach(() => registerUserKey());

    /** 요청이 이미 끊긴 뒤에 생성이 실패하도록, 생성을 붙잡아 두었다가 reject한다. */
    async function failAfterAbort(error: unknown) {
        const controller = new AbortController();
        let rejectGeneration: (reason: unknown) => void = () => undefined;
        core.deferred = new Promise<object>(
            (_, reject) => (rejectGeneration = reject)
        );
        const raw = await runRaw(
            { model: BYOK_MODEL },
            'pro',
            controller.signal
        );
        if (!isPublicToolStream(raw)) throw new Error('expected stream');
        controller.abort();
        rejectGeneration(error);
        return raw.completion;
    }

    it('끊긴 뒤의 provider 401은 provider_error로 분류하고 기록한다', async () => {
        const result = await failAfterAbort(
            new Anthropic.AuthenticationError(
                401,
                undefined,
                'invalid x-api-key',
                new Headers()
            )
        );
        expect(result).toMatchObject({
            ok: false,
            status: 502,
            code: 'provider_error',
            details: { provider: 'anthropic', status: 401 },
        });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('provider failure'),
            { provider: 'anthropic', status: 401 }
        );
    });

    it('끊긴 뒤의 라우팅 가드 위반은 tool_failed로 닫고 기록한다', async () => {
        const result = await failAfterAbort(new ByokOnlyRoutingError('test'));
        expect(result).toMatchObject({ ok: false, code: 'tool_failed' });
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('routing guard tripped'),
            expect.any(ByokOnlyRoutingError)
        );
    });

    it('끊긴 뒤의 알 수 없는 오류도 기록한다', async () => {
        const failure = new Error('db exploded');
        const result = await failAfterAbort(failure);
        expect(result).toMatchObject({ ok: false, code: 'tool_failed' });
        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining('failed'),
            failure
        );
    });
});

describe('BYOK 가드 — 생성 호출은 byokOnly 검사를 거친다', () => {
    const base = {
        symbol: 'AAPL',
        timeframe: '1Day' as const,
        model: BYOK_MODEL as ModelId,
        locale: 'en' as const,
        principal: principal('member'),
    };
    const signal = new AbortController().signal;
    const unchecked = {
        userId: USER_ID,
        tier: 'member' as const,
        userApiKey: USER_ANTHROPIC_KEY,
    };

    beforeEach(() => {
        m.news.mockResolvedValue({ status: 'done', result: {} });
    });

    it.each(['technical', 'news', 'overall', 'options'])(
        '%s: byokOnly 없는 호출자로 생성하면 core를 부르기 전에 거절한다',
        async kind => {
            const runner = await prepareRunner({ ...base, kind });
            await expect(
                runner.run({ cacheOnly: false, caller: unchecked, signal })
            ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
            expect(core.calls).toHaveLength(0);
            expect(m.news).not.toHaveBeenCalled();
            expect(m.overall).not.toHaveBeenCalled();
            expect(m.options).not.toHaveBeenCalled();
        }
    );

    it('technical: 키 없는 생성 호출은 core를 부르기 전에 거절한다', async () => {
        const runner = await prepareRunner({ ...base, kind: 'technical' });
        await expect(
            runner.run({
                cacheOnly: false,
                signal,
                caller: { userId: USER_ID, tier: 'member', byokOnly: true },
            })
        ).rejects.toBeInstanceOf(ByokOnlyRoutingError);
        expect(core.calls).toHaveLength(0);
    });

    it('technical: 키 없는 확인(cacheOnly) 호출은 byok-only로 core에 간다', async () => {
        const runner = await prepareRunner({
            ...base,
            kind: 'technical',
            model: FREE_MODEL as ModelId,
        });
        core.cache = { summary: 'cached' };
        await runner.run({
            cacheOnly: true,
            signal,
            caller: runner.callerFor(undefined),
        });
        expect(core.calls).toHaveLength(1);
        expect(core.calls[0]).toMatchObject({
            cacheOnly: true,
            keyPolicy: 'byok-only',
            tier: 'member',
        });
        expect(core.calls[0].userApiKey).toBeUndefined();
    });
});
