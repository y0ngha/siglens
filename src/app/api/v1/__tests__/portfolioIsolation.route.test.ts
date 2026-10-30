/**
 * 키 소유자 격리: `get_my_portfolio`는 인증된 키의 소유자 id로만 보유종목을 읽는다.
 *
 * 라우트 → 인증 → (실물) executePublicTool → (실물) createToolExecutor → (실물)
 * getMyPortfolioTool까지 실제 코드를 타고, 저장소만 "회원별 행"을 가진 fake로 바꾼다.
 * 그래서 어느 단계가 userId를 요청 값에서 가져오도록 바뀌면 이 테스트가 깨진다.
 */
const { mockAuth, mockConsume, findByUser, profile, getQuote } = vi.hoisted(
    () => ({
        mockAuth: vi.fn(),
        mockConsume: vi.fn(),
        findByUser: vi.fn(),
        profile: vi.fn(),
        getQuote: vi.fn(),
    })
);
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    authenticateApiKey: mockAuth,
}));
vi.mock('@/entities/siglens-api-key/server/rateLimit', async () => {
    const actual = await vi.importActual<
        typeof import('@/entities/siglens-api-key/server/rateLimit')
    >('@/entities/siglens-api-key/server/rateLimit');
    return { ...actual, consumeRateLimit: mockConsume };
});
vi.mock('@/entities/llm-provider/api/agent/router', () => ({
    AGENT_MODEL: 'deepseek-v4.1-flash',
}));
vi.mock('@/entities/news-article/server/ensureSymbolNewsFresh', () => ({
    ensureSymbolNewsFresh: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({
    searchTickerTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getQuote', () => ({ getQuoteTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getBarsIndicators', () => ({
    getBarsIndicatorsTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getCachedAnalysis', () => ({
    getCachedAnalysisTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getNews', () => ({ getNewsTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getOptionsSummary', () => ({
    getOptionsSummaryTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/runFreshAnalysis', () => ({
    runFreshAnalysisTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/webSearch', () => ({
    webSearchTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getFundamentals', () => ({
    getFundamentalsTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getMarketOverview', () => ({
    getMarketOverviewTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getEconomy', () => ({
    getEconomyTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getCongressTrades', () => ({
    getCongressTradesTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getGuide', () => ({ getGuideTool: vi.fn() }));
// 아래는 getMyPortfolioTool(실물)의 의존성.
vi.mock('@/entities/portfolio/api', () => ({
    DrizzlePortfolioRepository: vi.fn(function () {
        return { findByUser };
    }),
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: vi.fn(),
}));
vi.mock('@/shared/config/marketProfile/registry', () => ({
    getDescriptor: () => ({ priceFormat: { currency: 'USD' } }),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));

import { POST } from '@/app/api/v1/tools/[name]/route';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KEY_A = 'Bearer slk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const KEY_B = 'Bearer slk_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

const PRINCIPALS: Record<string, unknown> = {
    [KEY_A]: {
        keyId: 'key-a',
        keyName: 'A',
        keyPrefix: 'slk_AAAAAA',
        userId: USER_A,
        tier: 'member',
    },
    [KEY_B]: {
        keyId: 'key-b',
        keyName: 'B',
        keyPrefix: 'slk_BBBBBB',
        userId: USER_B,
        tier: 'member',
    },
};
/** 회원별 보유종목 행. 저장소 fake는 요청받은 userId의 행만 돌려준다. */
const HOLDINGS_BY_USER: Record<string, unknown[]> = {
    [USER_A]: [
        {
            symbol: 'AAPL',
            companyName: 'Apple',
            quantity: '10',
            averagePrice: '150',
        },
    ],
    [USER_B]: [
        {
            symbol: 'TSLA',
            companyName: 'Tesla',
            quantity: '3',
            averagePrice: '250',
        },
    ],
};

function portfolio(
    authorization: string,
    body: unknown = {}
): Promise<Response> {
    return POST(
        new Request('https://siglens.io/api/v1/tools/get_my_portfolio', {
            method: 'POST',
            headers: { authorization },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ name: 'get_my_portfolio' }) }
    );
}

const symbolsOf = async (response: Response): Promise<string[]> => {
    const body = (await response.json()) as {
        data: { holdings: Array<{ symbol: string }> };
    };
    return body.data.holdings.map(h => h.symbol);
};

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAuth.mockImplementation(async (header: string | null) => ({
        status: 'ok',
        principal: PRINCIPALS[header ?? ''],
    }));
    mockConsume.mockResolvedValue({
        allowed: true,
        window: 'minute',
        limit: 60,
        remaining: 59,
        resetAtEpochSeconds: 1_792_000_020,
        retryAfterSeconds: 20,
    });
    findByUser.mockImplementation(
        async (userId: string) => HOLDINGS_BY_USER[userId] ?? []
    );
    profile.mockResolvedValue('us-equity');
    getQuote.mockResolvedValue({ price: 200, changesPercentage: 1 });
});

describe('get_my_portfolio — 키 소유자 격리', () => {
    it('A의 키는 A의 보유종목만 본다', async () => {
        const response = await portfolio(KEY_A);
        expect(response.status).toBe(200);
        expect(await symbolsOf(response)).toEqual(['AAPL']);
        expect(findByUser).toHaveBeenCalledWith(USER_A);
        expect(findByUser).not.toHaveBeenCalledWith(USER_B);
    });

    it('B의 키는 B의 보유종목만 보고 A의 종목은 응답 어디에도 없다', async () => {
        const response = await portfolio(KEY_B);
        const text = await response.text();
        expect(
            JSON.parse(text).data.holdings.map(
                (h: { symbol: string }) => h.symbol
            )
        ).toEqual(['TSLA']);
        expect(text).not.toContain('AAPL');
        expect(findByUser).toHaveBeenCalledWith(USER_B);
        expect(findByUser).not.toHaveBeenCalledWith(USER_A);
    });

    it('본문으로 다른 회원 id를 넘기면 400이고 저장소를 읽지 않는다', async () => {
        const response = await portfolio(KEY_A, { userId: USER_B });
        expect(response.status).toBe(400);
        expect(findByUser).not.toHaveBeenCalled();
    });

    it.each(['user_id', 'user', 'ownerId', 'id'])(
        '%s 같은 우회 필드도 스키마에서 거절된다',
        async field => {
            const response = await portfolio(KEY_A, { [field]: USER_B });
            expect(response.status).toBe(400);
            expect(findByUser).not.toHaveBeenCalled();
        }
    );

    it('Authorization이 아닌 헤더로 회원을 바꿀 수 없다', async () => {
        const response = await POST(
            new Request('https://siglens.io/api/v1/tools/get_my_portfolio', {
                method: 'POST',
                headers: {
                    authorization: KEY_A,
                    'x-user-id': USER_B,
                    'x-siglens-user': USER_B,
                },
                body: '{}',
            }),
            { params: Promise.resolve({ name: 'get_my_portfolio' }) }
        );
        expect(await symbolsOf(response)).toEqual(['AAPL']);
        expect(findByUser).not.toHaveBeenCalledWith(USER_B);
    });

    it('두 회원의 요청이 겹쳐도 각자의 데이터만 받는다', async () => {
        const [a, b] = await Promise.all([portfolio(KEY_A), portfolio(KEY_B)]);
        expect(await symbolsOf(a)).toEqual(['AAPL']);
        expect(await symbolsOf(b)).toEqual(['TSLA']);
    });
});
