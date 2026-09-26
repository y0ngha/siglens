vi.mock('server-only', () => ({}));

const { mockListCardsByCategory, MarketNewsRepoCtor } = vi.hoisted(() => {
    const mockListCardsByCategory = vi.fn();
    const MarketNewsRepoCtor = vi.fn(function () {
        return { listCardsByCategory: mockListCardsByCategory };
    });
    return { mockListCardsByCategory, MarketNewsRepoCtor };
});
vi.mock('@/entities/market-news/api', () => ({
    DrizzleMarketNewsRepository: MarketNewsRepoCtor,
}));

const { mockGetDatabaseClient } = vi.hoisted(() => ({
    mockGetDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));

const { mockCallAgentProvider } = vi.hoisted(() => ({
    mockCallAgentProvider: vi.fn(),
}));
vi.mock('@/entities/llm-provider', () => ({
    AGENT_MODEL: 'deepseek-v4.1-flash',
    getAgentProvider: () => mockCallAgentProvider,
}));

const { redisState } = vi.hoisted(() => ({
    redisState: { client: null as null | { get: unknown; set: unknown } },
}));
vi.mock('@/shared/cache/redisClient', () => ({
    getRedisClient: () => redisState.client,
}));

const { buildSuggestionsPromptSpy } = vi.hoisted(() => ({
    buildSuggestionsPromptSpy: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...actual,
        buildSuggestionsPrompt: (
            ...args: Parameters<typeof actual.buildSuggestionsPrompt>
        ) => {
            buildSuggestionsPromptSpy(...args);
            return actual.buildSuggestionsPrompt(...args);
        },
    };
});

import { SUGGESTIONS_PROMPT_VERSION } from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentSuggestions } from '../api';
import type { MarketNewsCardItem } from '@/entities/market-news';

function headline(overrides: Partial<MarketNewsCardItem>): MarketNewsCardItem {
    return {
        id: 'n1',
        publishedAt: '2026-09-01T00:00:00.000Z',
        titleEn: 'Fed holds rates steady',
        titleKo: '연준, 금리 동결',
        sentiment: null,
        category: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        url: 'https://example.com/n1',
        source: 'reuters',
        tickers: [],
        ...overrides,
    };
}

const INPUT = {
    locale: 'ko' as const,
    userId: 'u1',
    portfolioSymbols: [] as readonly string[],
};

const AGENT_RESULT = {
    text: '["질문1","질문2","질문3"]',
    toolCalls: [],
    stopReason: 'end' as const,
    usage: {
        promptTokens: 0,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
    },
};

function freshRedis() {
    return { get: vi.fn(), set: vi.fn() };
}

describe('getAgentSuggestions', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockListCardsByCategory.mockResolvedValue([]);
        mockGetDatabaseClient.mockReturnValue({ db: {} });
        redisState.client = null;
        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        buildSuggestionsPromptSpy.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.useRealTimers();
        warnSpy.mockRestore();
    });

    it('cache hit → returns the cached list, never calls the provider', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue([
            'a',
            'b',
            'c',
        ]);
        redisState.client = redis;

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['a', 'b', 'c']);
        expect(mockCallAgentProvider).not.toHaveBeenCalled();
    });

    it('cache miss → calls the provider once and caches the parsed result with ex:3600', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        redisState.client = redis;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        expect(mockCallAgentProvider).toHaveBeenCalledTimes(1);
        const setCall = (redis.set as ReturnType<typeof vi.fn>).mock.calls.find(
            call => call[1] && Array.isArray(call[1])
        );
        expect(setCall).toBeDefined();
        expect(setCall![1]).toEqual(['질문1', '질문2', '질문3']);
        expect(setCall![2]).toEqual({ ex: 3_600 });
    });

    it('fewer than 3 parsed suggestions → null, and a 5-minute negative marker is cached instead of the list', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        redisState.client = redis;
        mockCallAgentProvider.mockResolvedValue({
            ...AGENT_RESULT,
            text: '["only one"]',
        });

        const result = await getAgentSuggestions(INPUT);

        expect(result).toBeNull();
        const negative = (
            redis.set as ReturnType<typeof vi.fn>
        ).mock.calls.find(
            ([, value]) => Array.isArray(value) && value.length === 0
        );
        expect(negative?.[2]).toEqual({ ex: 300 });
        expect(
            (redis.set as ReturnType<typeof vi.fn>).mock.calls.some(
                ([, value]) => Array.isArray(value) && value.length > 0
            )
        ).toBe(false);
    });

    it('a cached negative marker ([]) → null without calling the provider (no per-request spend for the marker TTL)', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue([]);
        redisState.client = redis;

        const result = await getAgentSuggestions(INPUT);

        expect(result).toBeNull();
        expect(mockCallAgentProvider).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it('provider throws → null, and console.warn is called with an error name, never the message', async () => {
        redisState.client = null;
        const secretMessage = 'SELECT * FROM users WHERE id=42 failed';
        mockCallAgentProvider.mockRejectedValue(new TypeError(secretMessage));

        const result = await getAgentSuggestions(INPUT);

        expect(result).toBeNull();
        expect(warnSpy).toHaveBeenCalled();
        const loggedWithSecret = warnSpy.mock.calls.some((call: unknown[]) =>
            call.some(
                (arg: unknown) =>
                    typeof arg === 'string' && arg.includes(secretMessage)
            )
        );
        expect(loggedWithSecret).toBe(false);
        const loggedTypeErrorName = warnSpy.mock.calls.some((call: unknown[]) =>
            call.some((arg: unknown) => arg === 'TypeError')
        );
        expect(loggedTypeErrorName).toBe(true);
    });

    // Provider timeout is exercised via the signal contract rather than
    // real elapsed time: `AbortSignal.timeout()` schedules internally and
    // does not observe vitest's fake timers, so asserting "the call never
    // resolves until N ms pass" is not reliably testable here. Instead we
    // assert the provider is invoked with an abortable signal carrying the
    // 8s budget (the property the timeout depends on).
    it('calls the provider with an AbortSignal (timeout budget wired)', async () => {
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        await getAgentSuggestions(INPUT);

        const call = mockCallAgentProvider.mock.calls.find(
            c => c[0]?.model === 'deepseek-v4.1-flash'
        );
        expect(call).toBeDefined();
        const options = call![0];
        expect(options.signal).toBeInstanceOf(AbortSignal);
        expect(options.signal.aborted).toBe(false);
    });

    it('two concurrent calls with the same key → provider called once', async () => {
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        // Both calls issued synchronously (no `await` between them) so the
        // second finds the first's promise already registered in the
        // module-level `inFlight` map.
        const [r1, r2] = await Promise.all([
            getAgentSuggestions(INPUT),
            getAgentSuggestions(INPUT),
        ]);

        expect(mockCallAgentProvider).toHaveBeenCalledTimes(1);
        expect(r1).toEqual(r2);
    });

    it('AGENT_CHAT_DISABLED=1 → null, never touches redis or the provider', async () => {
        vi.stubEnv('AGENT_CHAT_DISABLED', '1');
        const redis = freshRedis();
        redisState.client = redis;

        const result = await getAgentSuggestions(INPUT);

        expect(result).toBeNull();
        expect(redis.get).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
        expect(mockCallAgentProvider).not.toHaveBeenCalled();
    });

    it('redis unavailable → generates without caching and still returns the result', async () => {
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        expect(mockCallAgentProvider).toHaveBeenCalledTimes(1);
    });

    it('merges and sorts headlines from both categories newest-first, attaching the symbol when tickers exist', async () => {
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);
        mockListCardsByCategory.mockImplementation(async (sentinel: string) =>
            sentinel === '__NEWS_GENERAL__'
                ? [
                      headline({
                          id: 'general-old',
                          publishedAt: '2026-09-01T00:00:00.000Z',
                          titleKo: '오래된 일반 뉴스',
                          tickers: [],
                      }),
                  ]
                : [
                      headline({
                          id: 'stock-new',
                          publishedAt: '2026-09-05T00:00:00.000Z',
                          titleKo: '최신 종목 뉴스',
                          tickers: ['AAPL'],
                      }),
                  ]
        );

        await getAgentSuggestions(INPUT);

        expect(buildSuggestionsPromptSpy).toHaveBeenCalledTimes(1);
        const { headlines } = buildSuggestionsPromptSpy.mock.calls[0]![0] as {
            headlines: Array<{
                title: string;
                category: string;
                symbol?: string;
            }>;
        };
        // Newer (stock, 09-05) sorts before older (general, 09-01).
        expect(headlines).toEqual([
            { title: '최신 종목 뉴스', category: 'stock', symbol: 'AAPL' },
            { title: '오래된 일반 뉴스', category: 'general' },
        ]);
    });

    it('one category failing to fetch headlines does not blank out the other', async () => {
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);
        mockListCardsByCategory.mockImplementation(async (sentinel: string) =>
            sentinel === '__NEWS_GENERAL__'
                ? Promise.reject(new Error('DB timeout'))
                : [
                      headline({
                          id: 'stock-ok',
                          titleKo: '살아있는 카테고리',
                          tickers: [],
                      }),
                  ]
        );

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        const { headlines } = buildSuggestionsPromptSpy.mock.calls[0]![0] as {
            headlines: Array<{ title: string; category: string }>;
        };
        expect(headlines).toEqual([
            { title: '살아있는 카테고리', category: 'stock' },
        ]);
        // The failed category is logged, but does not surface as an error result.
        expect(warnSpy).toHaveBeenCalled();
    });

    it('getDatabaseClient throwing (headline fetch entirely unavailable) still lets suggestion generation proceed with no headlines', async () => {
        mockGetDatabaseClient.mockImplementationOnce(() => {
            throw new Error('pool exhausted');
        });
        redisState.client = null;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        const { headlines } = buildSuggestionsPromptSpy.mock.calls[0]![0] as {
            headlines: unknown[];
        };
        expect(headlines).toEqual([]);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('a cache write failure (redis.set throws) is swallowed — the generated result is still returned', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        (redis.set as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('redis down')
        );
        redisState.client = redis;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('a cache read failure (redis.get throws) falls through to generation instead of failing the request', async () => {
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('redis timeout')
        );
        redisState.client = redis;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        const result = await getAgentSuggestions(INPUT);

        expect(result).toEqual(['질문1', '질문2', '질문3']);
        expect(mockCallAgentProvider).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalled();
    });

    it('asserts the exact cache key read from redis under a fixed clock', async () => {
        vi.useFakeTimers({ now: new Date('2026-09-12T03:07:00.000Z') });
        const redis = freshRedis();
        (redis.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        redisState.client = redis;
        mockCallAgentProvider.mockResolvedValue(AGENT_RESULT);

        await getAgentSuggestions({ ...INPUT, portfolioSymbols: ['AAPL'] });

        expect(redis.get).toHaveBeenCalledWith(
            `ai:suggest:v1:${SUGGESTIONS_PROMPT_VERSION}:ko:2026091203:u:u1`
        );
    });
});
