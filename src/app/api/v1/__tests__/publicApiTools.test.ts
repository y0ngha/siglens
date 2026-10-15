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
    API_GENERATABLE_MODELS,
    API_KNOWN_MODELS,
} from '@/entities/siglens-api-key/lib/apiModels';
import {
    findPublicApiToolSpec,
    PUBLIC_API_EXCLUDED_TOOLS,
    PUBLIC_API_FRESH_ANALYSIS_TOOL,
    publicApiToolNames,
    publicApiToolSpecs,
} from '@/app/api/v1/publicApiTools';

/** 노출하는 도구. 새 도구가 늘면 의도적으로 여기도 고친다. */
const EXPECTED_TOOLS = [
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
    'run_fresh_analysis',
];

describe('publicApiToolNames', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('데이터 도구 12개와 BYOK 분석 도구를 정확히 노출한다', () => {
        expect([...publicApiToolNames()].toSorted()).toEqual(
            EXPECTED_TOOLS.toSorted()
        );
    });

    it('제외 목록은 web_search뿐이다(run_fresh_analysis는 BYOK 전용 구현으로 노출한다)', () => {
        expect([...PUBLIC_API_EXCLUDED_TOOLS]).toEqual(['web_search']);
    });

    it('검색 키가 있어 에이전트에선 web_search가 켜져도 API에는 나가지 않는다', () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'brave-test-key');
        expect(publicApiToolNames().has('web_search')).toBe(false);
        expect(publicApiToolNames().has('run_fresh_analysis')).toBe(true);
    });
});

describe('publicApiToolSpecs', () => {
    it('모든 노출 도구에 core 스펙이 있다(스펙 없는 실행기가 조용히 사라지지 않는다)', () => {
        expect(publicApiToolSpecs()).toHaveLength(publicApiToolNames().size);
    });

    it('run_fresh_analysis 외에는 core AGENT_TOOL_SPECS의 같은 객체이고 순서도 같다', () => {
        const expected = AGENT_TOOL_SPECS.filter(spec =>
            EXPECTED_TOOLS.includes(spec.name)
        );
        const actual = publicApiToolSpecs();
        expect(actual.map(spec => spec.name)).toEqual(
            expected.map(spec => spec.name)
        );
        actual.forEach((spec, index) => {
            if (spec.name === PUBLIC_API_FRESH_ANALYSIS_TOOL) return;
            expect(spec).toBe(expected[index]);
        });
    });
});

describe('run_fresh_analysis의 API 전용 스펙', () => {
    const core = AGENT_TOOL_SPECS.find(
        spec => spec.name === PUBLIC_API_FRESH_ANALYSIS_TOOL
    )!;
    const api = findPublicApiToolSpec(PUBLIC_API_FRESH_ANALYSIS_TOOL)!;

    it('core 스펙에 선택 인자 model만 더한다(필수 목록·추가 필드 금지는 그대로)', () => {
        expect(Object.keys(api.inputSchema.properties).toSorted()).toEqual(
            [...Object.keys(core.inputSchema.properties), 'model'].toSorted()
        );
        expect(api.inputSchema.required).toEqual(core.inputSchema.required);
        expect(api.inputSchema.additionalProperties).toBe(false);
        expect(api.costClass).toBe(core.costClass);
        expect(core.inputSchema.properties).not.toHaveProperty('model');
    });

    it('model 열거값은 로스터 전체, 설명은 생성 가능한 byok 모델을 나열한다', () => {
        const model = api.inputSchema.properties.model;
        expect(model.enum).toEqual([...API_KNOWN_MODELS]);
        for (const id of API_GENERATABLE_MODELS) {
            expect(model.enum).toContain(id);
            expect(model.description).toContain(id);
        }
        expect(model.description).not.toContain('claude-haiku-5-5');
    });

    it('설명은 에이전트용 문구("턴당 3회")가 아니라 BYOK·ai 한도를 말한다', () => {
        expect(core.description).toContain('at most 3 per turn');
        expect(api.description).not.toContain('at most 3 per turn');
        expect(api.description).toContain('YOUR registered LLM key');
    });

    it('listing과 단건 조회가 같은 스펙을 준다', () => {
        expect(
            publicApiToolSpecs().find(
                spec => spec.name === PUBLIC_API_FRESH_ANALYSIS_TOOL
            )
        ).toEqual(api);
    });
});

describe('findPublicApiToolSpec', () => {
    it('노출 도구는 스펙을 돌려준다', () => {
        expect(findPublicApiToolSpec('get_quote')?.name).toBe('get_quote');
        expect(findPublicApiToolSpec('run_fresh_analysis')?.name).toBe(
            'run_fresh_analysis'
        );
    });

    it.each(['web_search', 'no_such_tool', ''])('%j는 undefined', name => {
        expect(findPublicApiToolSpec(name)).toBeUndefined();
    });
});
