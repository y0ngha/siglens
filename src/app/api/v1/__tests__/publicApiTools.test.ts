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
vi.mock('@/app/api/ai/chat/tools/getInvestorFlows', () => ({
    getInvestorFlowsTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getGuide', () => ({ getGuideTool: vi.fn() }));

import { AGENT_TOOL_SPECS } from '@y0ngha/siglens-core';
import { API_KNOWN_MODELS } from '@/entities/siglens-api-key/lib/apiModels';
import { CHART_DATA_INDICATOR_NAMES } from '@/entities/bars/lib/chartDataIndicators';
import { renderChartDataNotes } from '@/entities/siglens-api-key/lib/buildSkillMarkdown';
import {
    PUBLIC_API_CHART_DATA,
    PUBLIC_API_CHART_DATA_MEASURED_SIZES as MEASURED,
} from '@/shared/config/publicApi';
import {
    findPublicApiToolSpec,
    isPublicApiOnlyTool,
    PUBLIC_API_EXCLUDED_TOOLS,
    PUBLIC_API_ONLY_TOOL_SPECS,
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
    'get_investor_flows',
    'get_guide',
    'get_my_portfolio',
    'run_fresh_analysis',
];

describe('publicApiToolNames', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('데이터 도구 13개와 BYOK 분석 도구를 정확히 노출한다', () => {
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
    it('모든 노출 도구에 core 스펙이 있다(스펙 없는 실행기가 조용히 사라지지 않는다) — 공개 API 전용 도구는 그 뒤에 더해진다', () => {
        expect(publicApiToolSpecs()).toHaveLength(
            publicApiToolNames().size + PUBLIC_API_ONLY_TOOL_SPECS.length
        );
    });

    it('run_fresh_analysis 외에는 core AGENT_TOOL_SPECS의 같은 객체이고 순서도 같다', () => {
        const expected = AGENT_TOOL_SPECS.filter(spec =>
            EXPECTED_TOOLS.includes(spec.name)
        );
        const actual = publicApiToolSpecs().filter(
            spec => !isPublicApiOnlyTool(spec.name)
        );
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

    it('model 열거값은 로스터 전체(등급 무관)이고, 설명은 어느 모델이든 사용자 키로 생성한다고 말한다', () => {
        const model = api.inputSchema.properties.model;
        expect(model.enum).toEqual([...API_KNOWN_MODELS]);
        expect(model.enum).toContain('claude-haiku-5-5');
        expect(model.enum).toContain('claude-opus-5');
        expect(model.description).toContain('your own provider key');
        expect(model.description).not.toContain('premium');
        expect(api.description).not.toContain('premium');
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

describe('get_chart_data (공개 API 전용 도구)', () => {
    const spec = findPublicApiToolSpec(PUBLIC_API_CHART_DATA.tool)!;

    it('에이전트 실행기·core 스펙에는 없고 API 목록에만 있다', () => {
        expect(publicApiToolNames().has(PUBLIC_API_CHART_DATA.tool)).toBe(
            false
        );
        expect(
            AGENT_TOOL_SPECS.some(s => s.name === PUBLIC_API_CHART_DATA.tool)
        ).toBe(false);
        expect(publicApiToolSpecs().map(s => s.name)).toContain(
            PUBLIC_API_CHART_DATA.tool
        );
        expect(isPublicApiOnlyTool(PUBLIC_API_CHART_DATA.tool)).toBe(true);
        expect(isPublicApiOnlyTool('get_quote')).toBe(false);
    });

    it('symbol·timeframe은 필수이고 indicators·bars는 선택, 추가 필드는 금지다', () => {
        expect(spec.inputSchema.required).toEqual(['symbol', 'timeframe']);
        expect(spec.inputSchema.additionalProperties).toBe(false);
        expect(Object.keys(spec.inputSchema.properties).toSorted()).toEqual([
            'bars',
            'indicators',
            'symbol',
            'timeframe',
        ]);
    });

    it('timeframe 열거값은 get_bars_indicators와 같다', () => {
        const core = AGENT_TOOL_SPECS.find(
            s => s.name === 'get_bars_indicators'
        )!;
        expect(spec.inputSchema.properties.timeframe.enum).toEqual(
            core.inputSchema.properties.timeframe.enum
        );
    });

    it('bars는 1..500 정수이고 설명에 기본값이 있다', () => {
        const bars = spec.inputSchema.properties.bars;
        expect(bars.type).toBe('integer');
        expect(bars.minimum).toBe(1);
        expect(bars.maximum).toBe(500);
        expect(bars.description).toContain('default 100');
    });

    it('indicators 원소 열거값은 all과 지표 이름 전체다', () => {
        const items = spec.inputSchema.properties.indicators.items;
        expect(items?.enum).toEqual(['all', ...CHART_DATA_INDICATOR_NAMES]);
    });

    it('측정 크기는 기본/최대 봉 수에서 잰 값이고 모두 안전 상한 안이며, 문서 문구가 그 값을 그대로 쓴다', () => {
        expect(MEASURED.shortBars).toBe(PUBLIC_API_CHART_DATA.defaultBars);
        expect(MEASURED.longBars).toBe(PUBLIC_API_CHART_DATA.maxBars);
        for (const size of [
            MEASURED.equity.short,
            MEASURED.equity.long,
            MEASURED.lowPricedCrypto.short,
            MEASURED.lowPricedCrypto.long,
        ])
            expect(size).toBeLessThan(PUBLIC_API_CHART_DATA.maxResponseChars);
        const note = renderChartDataNotes().join('\n');
        for (const size of [
            MEASURED.equity.short,
            MEASURED.equity.long,
            MEASURED.lowPricedCrypto.short,
            MEASURED.lowPricedCrypto.long,
        ])
            expect(note).toContain(size.toLocaleString('en-US'));
        expect(note).toContain(`${MEASURED.shortBars} bars`);
        expect(note).toContain(`${MEASURED.longBars} bars`);
    });

    it('설명이 smc 구간 앞 항목의 규칙(null 인덱스, startsBeforeWindow)을 말한다', () => {
        expect(spec.description).toContain('startsBeforeWindow: true');
        expect(spec.description).toContain('ALL fall before the window');
    });
});
