/**
 * `get_news`는 에이전트에서 심볼을 읽기 전에 `ensureSymbolData`로 FMP 적재와 서버 키 LLM 뉴스
 * 카드 분석을 돌린다. 공개 API는 서버 비용을 쓰지 않으므로 그 경로 전체가 꺼져 있어야 한다.
 *
 * 라우트 → (실물) executePublicTool → (실물) createToolExecutor → (실물) getNewsTool →
 * (실물) ensureSymbolNewsFresh까지 타되, 적재·분석·저장소만 spy로 바꿔 "한 번도 불리지 않음"을
 * 단언한다. 같은 spy가 에이전트 설정(기본 옵션)에서는 실제로 불리는지 대조군으로 확인해
 * 단언이 공회전하지 않음을 보인다.
 */
const {
    mockAuth,
    mockConsume,
    mockIngest,
    mockAnalyzeCards,
    mockAfter,
    mockIsRecentlyFetched,
    mockListCardsBySymbol,
    mockListBySymbol,
} = vi.hoisted(() => ({
    mockAuth: vi.fn(),
    mockConsume: vi.fn(),
    mockIngest: vi.fn(),
    mockAnalyzeCards: vi.fn(),
    mockAfter: vi.fn(),
    mockIsRecentlyFetched: vi.fn(),
    mockListCardsBySymbol: vi.fn(),
    mockListBySymbol: vi.fn(),
}));
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
// 비용이 드는 경로의 부품들 — 불리면 안 된다.
vi.mock(
    '@/entities/news-article/lib/ingestNewsForSymbol',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/news-article/lib/ingestNewsForSymbol')
        >()),
        ingestNewsForSymbol: mockIngest,
    })
);
vi.mock('@/entities/news-article/lib/analyzeNewsCards', () => ({
    analyzeNewsCards: mockAnalyzeCards,
}));
vi.mock('@/entities/news-article/lib/newsRefreshFlag', () => ({
    isRecentlyFetched: mockIsRecentlyFetched,
}));
vi.mock('@/entities/news-article/lib/selectUnanalyzed', () => ({
    selectUnanalyzed: vi.fn(() => []),
}));
vi.mock('next/server', () => ({ after: mockAfter }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/entities/news-article/api', () => ({
    DrizzleNewsRepository: class {
        listCardsBySymbol = mockListCardsBySymbol;
        listBySymbol = mockListBySymbol;
    },
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    DrizzleMarketNewsRepository: class {
        listCardsByCategory = vi.fn();
    },
}));
vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: vi.fn(),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => ({ db: {} }),
}));
// 나머지 실행기 모듈 — 이 테스트와 무관하다.
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
vi.mock('@/app/api/ai/chat/tools/getOptionsSummary', () => ({
    getOptionsSummaryTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getMyPortfolio', () => ({
    getMyPortfolioTool: vi.fn(),
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

import { POST } from '@/app/api/v1/tools/[name]/route';
import { createToolExecutor } from '@/app/api/ai/chat/tools/chatTools';

const principal = {
    keyId: 'key-1',
    keyName: 'n',
    keyPrefix: 'slk_abcdef',
    userId: 'user-1',
    tier: 'member' as const,
};
const storedCard = {
    titleEn: 'Apple unveils a chip',
    titleKo: null,
    summaryKo: null,
    summaryEn: 'A stored summary',
    publishedAt: new Date('2026-10-14T12:00:00Z'),
    link: 'https://example.test/apple',
    source: 'Example Wire',
};

function getNews(body: unknown): Promise<Response> {
    return POST(
        new Request('https://siglens.io/api/v1/tools/get_news', {
            method: 'POST',
            headers: { authorization: 'Bearer slk_x' },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ name: 'get_news' }) }
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAuth.mockResolvedValue({ status: 'ok', principal });
    mockConsume.mockResolvedValue({
        allowed: true,
        window: 'minute',
        limit: 60,
        remaining: 59,
        resetAtEpochSeconds: 1_792_000_020,
        retryAfterSeconds: 20,
    });
    // 게이트가 열려 있어(최근 적재 없음) 에이전트라면 반드시 적재에 들어가는 상태.
    mockIsRecentlyFetched.mockResolvedValue(false);
    mockIngest.mockResolvedValue({ inserted: 3, updated: 0 });
    mockListCardsBySymbol.mockResolvedValue([storedCard]);
    mockListBySymbol.mockResolvedValue([]);
});

describe('POST /api/v1/tools/get_news — 서버 비용 경로 차단', () => {
    it('FMP 적재·LLM 뉴스 카드 분석·after() 후속 작업에 한 번도 닿지 않는다', async () => {
        const response = await getNews({ symbol: 'AAPL' });
        expect(response.status).toBe(200);
        expect(mockIngest).not.toHaveBeenCalled();
        expect(mockAnalyzeCards).not.toHaveBeenCalled();
        expect(mockAfter).not.toHaveBeenCalled();
        expect(mockIsRecentlyFetched).not.toHaveBeenCalled();
    });

    it('이미 저장된 기사만 돌려준다', async () => {
        const response = await getNews({ symbol: 'AAPL' });
        const body = (await response.json()) as {
            data: { items?: Array<{ title: string }> };
        };
        expect(mockListCardsBySymbol).toHaveBeenCalledTimes(1);
        expect(JSON.stringify(body.data)).toContain('Apple unveils a chip');
    });

    it('대조군: 같은 도구를 에이전트 기본 옵션으로 만들면 적재가 실제로 불린다', async () => {
        const execute = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        await execute(
            'get_news',
            { symbol: 'AAPL' },
            {
                userId: 'user-1',
                tier: 'member',
                locale: 'en',
                signal: new AbortController().signal,
            }
        );
        expect(mockIngest).toHaveBeenCalledTimes(1);
    });
});
