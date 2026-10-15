vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    // 실행기가 가진 도구 전부(제외 대상 포함) — 제외는 publicApiTools(실물)가 맡는다.
    availableToolNames: () =>
        new Set([
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
            'web_search',
        ]),
    createToolExecutor: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({ SITE_URL: 'https://example.test' }));

import { AGENT_TOOL_SPECS } from '@y0ngha/siglens-core';
import { GET } from '@/app/api/v1/skill/route';
import { publicApiToolSpecs } from '@/app/api/v1/publicApiTools';

/** 마크다운의 도구 섹션 제목(### `name`)만 뽑는다 — 설명문 속 언급과 구분하려고 제목으로 센다. */
function toolHeadings(markdown: string): string[] {
    return [...markdown.matchAll(/^### `([a-z_]+)`$/gm)].map(m => m[1]);
}

describe('GET /api/v1/skill', () => {
    it('인증 없이 text/markdown으로 내려준다', async () => {
        const response = await GET();
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe(
            'text/markdown; charset=utf-8'
        );
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('노출 도구를 정확히 나열한다(스펙 순서 그대로)', async () => {
        const markdown = await (await GET()).text();
        const exposed = publicApiToolSpecs().map(spec => spec.name);
        expect(toolHeadings(markdown)).toEqual(exposed);
        expect(exposed).toHaveLength(12);
    });

    it('web_search와 run_fresh_analysis는 도구로 나열하지 않는다', async () => {
        const markdown = await (await GET()).text();
        const headings = toolHeadings(markdown);
        expect(headings).not.toContain('web_search');
        expect(headings).not.toContain('run_fresh_analysis');
        // 제외 도구도 core 스펙에는 실제로 있다 — 목록에서 빠진 이유가 "원래 없어서"가 아님을 보인다.
        const coreNames = AGENT_TOOL_SPECS.map(spec => spec.name);
        expect(coreNames).toContain('web_search');
        expect(coreNames).toContain('run_fresh_analysis');
    });

    it('기본 URL은 사이트 URL 설정에서 온다', async () => {
        const markdown = await (await GET()).text();
        expect(markdown).toContain(
            'curl -s -X POST https://example.test/api/v1/tools/<name>'
        );
        expect(markdown).toContain('GET https://example.test/api/v1/tools');
    });

    it('PR-A에서는 BYOK 생성 안내를 싣지 않는다', async () => {
        const markdown = await (await GET()).text();
        expect(markdown).not.toContain('BYOK');
    });
});
