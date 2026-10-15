vi.mock('@/entities/news-article/lib/ensureSymbolNewsFresh', () => ({
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

import { AGENT_TOOL_SPECS } from '@y0ngha/siglens-core';
import {
    findPublicApiToolSpec,
    PUBLIC_API_EXCLUDED_TOOLS,
    publicApiToolNames,
    publicApiToolSpecs,
} from '@/app/api/v1/publicApiTools';

/** PR-A에서 노출하는 데이터 도구. 새 도구가 늘면 의도적으로 여기도 고친다. */
const EXPECTED_PR_A_TOOLS = [
    'search_ticker',
    'get_quote',
    'get_bars_indicators',
    'get_cached_analysis',
    'get_news',
    'get_options_summary',
    'get_fundamentals',
    'get_market_overview',
    'get_economy',
    'get_congress_trades',
    'get_guide',
    'get_my_portfolio',
];

describe('publicApiToolNames', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('PR-A 데이터 도구 12개를 정확히 노출한다', () => {
        expect([...publicApiToolNames()].toSorted()).toEqual(
            EXPECTED_PR_A_TOOLS.toSorted()
        );
    });

    it('web_search와 run_fresh_analysis는 제외 목록에 있다', () => {
        expect([...PUBLIC_API_EXCLUDED_TOOLS].toSorted()).toEqual([
            'run_fresh_analysis',
            'web_search',
        ]);
    });

    it('검색 키가 있어 에이전트에선 web_search가 켜져도 API에는 나가지 않는다', () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'brave-test-key');
        expect(publicApiToolNames().has('web_search')).toBe(false);
        expect(publicApiToolNames().has('run_fresh_analysis')).toBe(false);
    });
});

describe('publicApiToolSpecs', () => {
    it('모든 노출 도구에 core 스펙이 있다(스펙 없는 실행기가 조용히 사라지지 않는다)', () => {
        expect(publicApiToolSpecs()).toHaveLength(publicApiToolNames().size);
    });

    it('스펙은 core AGENT_TOOL_SPECS의 같은 객체이고 순서도 같다', () => {
        const expected = AGENT_TOOL_SPECS.filter(spec =>
            EXPECTED_PR_A_TOOLS.includes(spec.name)
        );
        expect(publicApiToolSpecs()).toEqual(expected);
        publicApiToolSpecs().forEach((spec, index) => {
            expect(spec).toBe(expected[index]);
        });
    });
});

describe('findPublicApiToolSpec', () => {
    it('노출 도구는 스펙을 돌려준다', () => {
        expect(findPublicApiToolSpec('get_quote')?.name).toBe('get_quote');
    });

    it.each(['web_search', 'run_fresh_analysis', 'no_such_tool', ''])(
        '%j는 undefined',
        name => {
            expect(findPublicApiToolSpec(name)).toBeUndefined();
        }
    );
});
