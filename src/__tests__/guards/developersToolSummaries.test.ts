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
import { describe, expect, it } from 'vitest';
import {
    PUBLIC_API_ONLY_TOOL_SPECS,
    publicApiToolSpecs,
} from '@/app/api/v1/publicApiTools';
import { LOCALES } from '@/shared/i18n/locales';
import en from '../../../messages/en.json';
import ja from '../../../messages/ja.json';
import ko from '../../../messages/ko.json';
import zh from '../../../messages/zh.json';

/**
 * **`/developers` 도구 레퍼런스의 사람용 요약 가드.**
 *
 * 카드는 코어가 에이전트에게 쓴 영어 설명(긴 단락)을 싣지 않고 카탈로그의 한두 문장 요약
 * (`views.developers.tools.summaries.<tool>`)만 보여 준다. 요약이 없는 도구는 카드에 사람이 읽을 설명이
 * 하나도 없게 되므로, API가 내보내는 도구 목록(`publicApiToolSpecs`)과 요약 키를 네 로케일 모두에서 대조한다 —
 * 코어에 새 도구가 생기면 이 테스트가 먼저 실패한다.
 */

const catalogs = { ko, en, ja, zh } as const;

const exposed = publicApiToolSpecs().map(spec => spec.name);

describe('/developers 도구 요약', () => {
    it('노출 도구가 하나 이상이고 core 스펙이거나 공개 API 전용 스펙에서 온다', () => {
        expect(exposed.length).toBeGreaterThan(0);
        const knownNames = [
            ...AGENT_TOOL_SPECS,
            ...PUBLIC_API_ONLY_TOOL_SPECS,
        ].map(spec => spec.name);
        for (const name of exposed) expect(knownNames).toContain(name);
    });

    it.each(LOCALES)(
        '%s: API가 내보내는 모든 도구에 비어 있지 않은 요약이 있다',
        locale => {
            const summaries: Record<string, string> =
                catalogs[locale].views.developers.tools.summaries;
            const missing = exposed.filter(
                name => (summaries[name] ?? '').trim() === ''
            );
            expect(
                missing,
                `views.developers.tools.summaries에 요약이 없는 도구 (${locale}) — 카드에 사람이 읽을 설명이 없다`
            ).toEqual([]);
        }
    );

    it.each(LOCALES)(
        '%s: 노출되지 않는 도구의 요약은 남아 있지 않다',
        locale => {
            const summaries = catalogs[locale].views.developers.tools.summaries;
            expect(Object.keys(summaries).toSorted()).toEqual(
                exposed.toSorted()
            );
        }
    );
});
