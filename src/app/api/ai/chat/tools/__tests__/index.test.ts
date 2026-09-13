import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspect } from 'node:util';

const { search, getOptionsSummary, getCachedAnalysis } = vi.hoisted(() => ({
    search: vi.fn(),
    getOptionsSummary: vi.fn(),
    getCachedAnalysis: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({
    searchTickerTool: search,
}));
vi.mock('@/app/api/ai/chat/tools/getQuote', () => ({ getQuoteTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getBarsIndicators', () => ({
    getBarsIndicatorsTool: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/getCachedAnalysis', () => ({
    getCachedAnalysisTool: getCachedAnalysis,
}));
vi.mock('@/app/api/ai/chat/tools/getNews', () => ({ getNewsTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getOptionsSummary', () => ({
    getOptionsSummaryTool: getOptionsSummary,
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
const e2eState = vi.hoisted(() => ({ on: false }));
const naverState = vi.hoisted(() => ({ creds: false }));
vi.mock('@/entities/news-article/api', () => ({
    naverAiCredentials: () =>
        naverState.creds ? { id: 'ai', secret: 's' } : null,
    searchNaverNews: vi.fn(),
    searchNaverWeb: vi.fn(),
    stripNaverMarkup: (s: string) => s,
    toIsoPublishedAt: () => null,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => e2eState.on }));

import {
    availableToolNames,
    createToolExecutor,
} from '@/app/api/ai/chat/tools';
import { guestSubject } from '@/app/api/ai/chat/guestSubject';

function makeCtx(aborted = false) {
    const controller = new AbortController();
    if (aborted) controller.abort();
    return {
        userId: 'u1',
        tier: 'member' as const,
        locale: 'ko' as const,
        signal: controller.signal,
    };
}

describe('tool registry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('가용 툴 8종(web_search는 키 있을 때만)', () => {
        expect([...availableToolNames()].sort()).toEqual([
            'get_bars_indicators',
            'get_cached_analysis',
            'get_my_portfolio',
            'get_news',
            'get_options_summary',
            'get_quote',
            'run_fresh_analysis',
            'search_ticker',
        ]);
    });

    it('BRAVE_SEARCH_API_KEY가 있으면 web_search도 가용 목록에 포함된다', () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        expect(availableToolNames().has('web_search')).toBe(true);
    });

    it('에이전트 전용 네이버 자격증명(NAVER_AI_CLIENT_*)만 있어도 web_search가 가용 목록에 포함된다', () => {
        naverState.creds = true;
        try {
            expect(availableToolNames().has('web_search')).toBe(true);
        } finally {
            naverState.creds = false;
        }
    });

    it('E2E에서는 키가 있어도 web_search를 빼고, AGENT_REAL_PROVIDER=1(실제 프로바이더 dev)이면 다시 넣는다', () => {
        vi.stubEnv('BRAVE_SEARCH_API_KEY', 'b');
        e2eState.on = true;
        try {
            expect(availableToolNames().has('web_search')).toBe(false);
            vi.stubEnv('AGENT_REAL_PROVIDER', '1');
            expect(availableToolNames().has('web_search')).toBe(true);
        } finally {
            e2eState.on = false;
        }
    });

    it('심볼 형태가 아니면 실행하지 않는다', async () => {
        expect(
            await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })(
                'get_options_summary',
                { symbol: '../etc' },
                makeCtx()
            )
        ).toEqual({ error: 'invalid_symbol' });
        expect(getOptionsSummary).not.toHaveBeenCalled();
    });

    it.each(['get_my_portfolio', 'run_fresh_analysis', 'web_search'])(
        '게스트의 %s → login_required, 실행기 미호출',
        async name => {
            const { getMyPortfolioTool } =
                await import('@/app/api/ai/chat/tools/getMyPortfolio');
            const { runFreshAnalysisTool } =
                await import('@/app/api/ai/chat/tools/runFreshAnalysis');
            const { webSearchTool } =
                await import('@/app/api/ai/chat/tools/webSearch');
            const execute = createToolExecutor({ analysisModel: 'm' as never });
            await expect(
                execute(
                    name,
                    { symbol: 'AAPL', query: 'x' },
                    {
                        ...makeCtx(),
                        userId: guestSubject('203.0.113.7'),
                        tier: 'free' as never,
                    }
                )
            ).resolves.toEqual({ error: 'login_required' });
            expect(getMyPortfolioTool).not.toHaveBeenCalled();
            expect(runFreshAnalysisTool).not.toHaveBeenCalled();
            expect(webSearchTool).not.toHaveBeenCalled();
        }
    );

    it('게스트도 공개 데이터 툴은 그대로 실행한다', async () => {
        search.mockResolvedValue({ results: [] });
        const execute = createToolExecutor({ analysisModel: 'm' as never });
        await execute(
            'search_ticker',
            { query: 'apple' },
            { ...makeCtx(), userId: guestSubject('203.0.113.7') }
        );
        expect(search).toHaveBeenCalledTimes(1);
    });

    it('알 수 없는 툴 이름 → unknown_tool', async () => {
        expect(
            await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })(
                'nope',
                {},
                makeCtx()
            )
        ).toEqual({ error: 'unknown_tool' });
    });

    it('signal이 이미 aborted면 실행기를 호출하지 않고 aborted를 반환한다', async () => {
        search.mockResolvedValue({ ok: true });
        expect(
            await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })(
                'search_ticker',
                { query: 'x' },
                makeCtx(true)
            )
        ).toEqual({ error: 'aborted' });
        expect(search).not.toHaveBeenCalled();
    });

    it('실행기 예외 → tool_failed, 메시지는 절대 노출하지 않는다 (item 1)', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            const sqlError = new Error(
                'duplicate key value violates unique constraint "portfolio_user_id_symbol" — userId=u1-secret, params: [SELECT * FROM portfolio_holdings WHERE user_id = $1]'
            );
            sqlError.name = 'DrizzleQueryError';
            (sqlError as Error & { cause?: { code: string } }).cause = {
                code: '23505',
            };
            search.mockRejectedValue(sqlError);

            const result = await createToolExecutor({
                analysisModel: 'deepseek-v4.1-flash',
            })('search_ticker', { query: 'x' }, makeCtx());

            expect(result).toEqual({ error: 'tool_failed' });
            expect(result).not.toHaveProperty('message');

            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
            const loggedArgs = consoleErrorSpy.mock.calls[0]!;
            // Error.message/stack are non-enumerable, so JSON.stringify would
            // silently hide a leak here even if the code passed the whole
            // Error object — util.inspect walks non-enumerable props too and
            // is the same tool a human reading the server log would use.
            const inspected = loggedArgs.map(arg => inspect(arg)).join(' ');
            expect(inspected).not.toContain('u1-secret');
            expect(inspected).not.toContain('SELECT');
            expect(inspected).not.toContain('portfolio_holdings');
            expect(inspected).toContain('DrizzleQueryError');
            expect(inspected).toContain('23505');
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('결과는 절단을 거친다', async () => {
        search.mockResolvedValue({ big: 'x'.repeat(10_000) });
        expect(
            await createToolExecutor({ analysisModel: 'deepseek-v4.1-flash' })(
                'search_ticker',
                { query: 'x' },
                makeCtx()
            )
        ).toMatchObject({ truncated: true });
    });

    it('get_cached_analysis만 자체 한도 — 4,000자를 넘는 저장 분석(원문+평이화)도 온전히 넘긴다', async () => {
        const analysis = {
            found: true,
            analysis: 'a'.repeat(6_000),
            plain: 'p'.repeat(2_000),
        };
        getCachedAnalysis.mockResolvedValue(analysis);
        const exec = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        expect(
            await exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            )
        ).toBe(analysis);
        // The ceiling still exists.
        getCachedAnalysis.mockResolvedValue({ analysis: 'a'.repeat(20_000) });
        expect(
            await exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            )
        ).toMatchObject({ truncated: true });
    });

    it('get_cached_analysis의 큰 한도는 턴당 예산 안에서만 — 소진 뒤 조회는 기본 4,000자로 잘린다', async () => {
        const big = () => ({ analysis: 'a'.repeat(11_000) });
        getCachedAnalysis.mockImplementation(async () => big());
        const exec = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        const call = () =>
            exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            );
        expect(await call()).not.toHaveProperty('truncated');
        expect(await call()).not.toHaveProperty('truncated');
        const third = await call();
        expect(third).toMatchObject({ truncated: true });
        expect(JSON.stringify(third).length).toBeLessThanOrEqual(4_000);
        // A new turn gets a fresh allowance.
        const next = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        expect(
            await next(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            )
        ).not.toHaveProperty('truncated');
    });

    it('경계값: 남은 예산이 정확히 12,000자면 12,000자 결과가 통과, 예산이 바닥이어도 4,000자까지는 온전하다', async () => {
        const sized = (n: number) => ({ a: 'x'.repeat(n - '{"a":""}'.length) });
        const exec = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        const call = () =>
            exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            );
        // 24,000 − 12,000 = exactly 12,000 left.
        getCachedAnalysis.mockResolvedValueOnce(sized(12_000));
        expect(JSON.stringify(await call())).toHaveLength(12_000);
        getCachedAnalysis.mockResolvedValueOnce(sized(12_000));
        expect(await call()).not.toHaveProperty('truncated');
        // Budget is now 0: the floor is the default 4,000.
        getCachedAnalysis.mockResolvedValueOnce(sized(4_000));
        expect(await call()).not.toHaveProperty('truncated');
        getCachedAnalysis.mockResolvedValueOnce(sized(4_001));
        expect(await call()).toMatchObject({ truncated: true });
    });
});
