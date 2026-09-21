import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspect } from 'node:util';

const {
    search,
    getOptionsSummary,
    getCachedAnalysis,
    getBarsIndicators,
    getNews,
    ensureSymbolNewsFresh,
} = vi.hoisted(() => ({
    search: vi.fn(),
    getOptionsSummary: vi.fn(),
    getCachedAnalysis: vi.fn(),
    getBarsIndicators: vi.fn(),
    getNews: vi.fn(),
    ensureSymbolNewsFresh: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/ensureSymbolDataFresh', () => ({
    ensureSymbolNewsFresh,
}));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({
    searchTickerTool: search,
}));
vi.mock('@/app/api/ai/chat/tools/getQuote', () => ({ getQuoteTool: vi.fn() }));
vi.mock('@/app/api/ai/chat/tools/getBarsIndicators', () => ({
    getBarsIndicatorsTool: getBarsIndicators,
}));
vi.mock('@/app/api/ai/chat/tools/getCachedAnalysis', () => ({
    getCachedAnalysisTool: getCachedAnalysis,
}));
vi.mock('@/app/api/ai/chat/tools/getNews', () => ({ getNewsTool: getNews }));
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
    type ToolRuntime,
} from '@/app/api/ai/chat/tools';
import { guestSubject } from '@/app/api/ai/chat/guestSubject';
import {
    BARS_RESULT_MAX_CHARS,
    CACHED_ANALYSIS_MAX_CHARS,
    CACHED_ANALYSIS_TURN_BUDGET_CHARS,
    TOOL_RESULT_MAX_CHARS,
} from '@/app/api/ai/chat/tools/truncate';

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

    it('가용 툴 12종(web_search는 키 있을 때만)', () => {
        expect([...availableToolNames()].sort()).toEqual([
            'get_bars_indicators',
            'get_cached_analysis',
            'get_congress_trades',
            'get_economy',
            'get_fundamentals',
            'get_market_overview',
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

    it('게스트의 get_my_portfolio → login_required, 실행기 미호출', async () => {
        const { getMyPortfolioTool } =
            await import('@/app/api/ai/chat/tools/getMyPortfolio');
        const execute = createToolExecutor({ analysisModel: 'm' as never });
        await expect(
            execute(
                'get_my_portfolio',
                {},
                {
                    ...makeCtx(),
                    userId: guestSubject(
                        '11111111-1111-4111-8111-111111111111'
                    ),
                    tier: 'free' as never,
                }
            )
        ).resolves.toEqual({ error: 'login_required' });
        expect(getMyPortfolioTool).not.toHaveBeenCalled();
    });

    it.each(['run_fresh_analysis', 'web_search'])(
        '게스트도 %s는 실행한다 — 분석·검색은 로그인 없이 쓸 수 있다',
        async name => {
            const { runFreshAnalysisTool } =
                await import('@/app/api/ai/chat/tools/runFreshAnalysis');
            const { webSearchTool } =
                await import('@/app/api/ai/chat/tools/webSearch');
            vi.mocked(runFreshAnalysisTool).mockResolvedValue({ found: true });
            vi.mocked(webSearchTool).mockResolvedValue({ results: [] });
            const execute = createToolExecutor({ analysisModel: 'm' as never });
            const result = await execute(
                name,
                { symbol: 'AAPL', kind: 'technical', query: 'x' },
                {
                    ...makeCtx(),
                    userId: guestSubject(
                        '11111111-1111-4111-8111-111111111111'
                    ),
                    tier: 'free' as never,
                }
            );
            expect(result).not.toEqual({ error: 'login_required' });
            expect(
                name === 'web_search' ? webSearchTool : runFreshAnalysisTool
            ).toHaveBeenCalledTimes(1);
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
        getCachedAnalysis.mockResolvedValue({
            analysis: 'a'.repeat(CACHED_ANALYSIS_MAX_CHARS + 5_000),
        });
        expect(
            await exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'overall' },
                makeCtx()
            )
        ).toMatchObject({ truncated: true });
    });

    it('run_fresh_analysis도 저장 분석과 같은 한도·턴 예산을 쓴다 — 방금 만든 분석이 4,000자에서 잘리지 않는다', async () => {
        const { runFreshAnalysisTool } =
            await import('@/app/api/ai/chat/tools/runFreshAnalysis');
        const fresh = {
            found: true,
            analysis: 'a'.repeat(6_000),
            plain: 'p'.repeat(2_000),
        };
        vi.mocked(runFreshAnalysisTool).mockResolvedValue(fresh);
        getCachedAnalysis.mockResolvedValue({
            analysis: 'c'.repeat(CACHED_ANALYSIS_MAX_CHARS),
        });
        const exec = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        expect(
            await exec(
                'run_fresh_analysis',
                { symbol: 'AAPL', kind: 'overall' },
                makeCtx()
            )
        ).toBe(fresh);
        // The fresh result drew on the same per-turn allowance: after it, one
        // more `CACHED_ANALYSIS_MAX_CHARS`-sized stored analysis still fits,
        // the next one does not.
        await exec(
            'get_cached_analysis',
            { symbol: 'AAPL', tab: 'overall' },
            makeCtx()
        );
        expect(
            await exec(
                'get_cached_analysis',
                { symbol: 'AAPL', tab: 'technical' },
                makeCtx()
            )
        ).toMatchObject({ truncated: true });
    });

    it('get_cached_analysis의 큰 한도는 턴당 예산 안에서만 — 소진 뒤 조회는 기본 TOOL_RESULT_MAX_CHARS로 잘린다', async () => {
        const big = () => ({
            analysis: 'a'.repeat(CACHED_ANALYSIS_MAX_CHARS - 1_000),
        });
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
        expect(JSON.stringify(third).length).toBeLessThanOrEqual(
            TOOL_RESULT_MAX_CHARS
        );
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

    it('경계값: 남은 예산이 정확히 CACHED_ANALYSIS_MAX_CHARS면 그 크기 결과가 통과, 예산이 바닥이어도 TOOL_RESULT_MAX_CHARS까지는 온전하다', async () => {
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
        // CACHED_ANALYSIS_TURN_BUDGET_CHARS − CACHED_ANALYSIS_MAX_CHARS =
        // exactly CACHED_ANALYSIS_MAX_CHARS left (turn budget is 2×).
        getCachedAnalysis.mockResolvedValueOnce(
            sized(CACHED_ANALYSIS_MAX_CHARS)
        );
        expect(JSON.stringify(await call())).toHaveLength(
            CACHED_ANALYSIS_MAX_CHARS
        );
        getCachedAnalysis.mockResolvedValueOnce(
            sized(CACHED_ANALYSIS_MAX_CHARS)
        );
        expect(await call()).not.toHaveProperty('truncated');
        // Budget is now 0: the floor is the default TOOL_RESULT_MAX_CHARS.
        getCachedAnalysis.mockResolvedValueOnce(sized(TOOL_RESULT_MAX_CHARS));
        expect(await call()).not.toHaveProperty('truncated');
        getCachedAnalysis.mockResolvedValueOnce(
            sized(TOOL_RESULT_MAX_CHARS + 1)
        );
        expect(await call()).toMatchObject({ truncated: true });
        // Sanity: the turn budget really is 2× the per-call ceiling — this
        // boundary math only holds while that invariant does.
        expect(CACHED_ANALYSIS_TURN_BUDGET_CHARS).toBe(
            2 * CACHED_ANALYSIS_MAX_CHARS
        );
    });

    it('get_bars_indicators만 BARS_RESULT_MAX_CHARS 한도 — 4,000자 초과·6,000자 이내는 온전히, 6,000자 초과는 절단된다', async () => {
        const sized = (n: number) => ({ a: 'x'.repeat(n - '{"a":""}'.length) });
        const exec = createToolExecutor({
            analysisModel: 'deepseek-v4.1-flash',
        });
        const call = () =>
            exec('get_bars_indicators', { symbol: 'AAPL' }, makeCtx());
        // Regression guard for `ceilingFor` ignoring the bars ceiling: a
        // result strictly between TOOL_RESULT_MAX_CHARS (4,000) and
        // BARS_RESULT_MAX_CHARS (6,000) would be collapsed into a
        // `{truncated, preview}` blob by the shared 4,000 default.
        const midSize = Math.floor(
            (TOOL_RESULT_MAX_CHARS + BARS_RESULT_MAX_CHARS) / 2
        );
        getBarsIndicators.mockResolvedValueOnce(sized(midSize));
        const mid = await call();
        expect(mid).not.toHaveProperty('truncated');
        expect(JSON.stringify(mid).length).toBe(midSize);

        getBarsIndicators.mockResolvedValueOnce(
            sized(BARS_RESULT_MAX_CHARS + 500)
        );
        const over = await call();
        expect(over).toMatchObject({ truncated: true });
        expect(JSON.stringify(over).length).toBeLessThanOrEqual(
            BARS_RESULT_MAX_CHARS
        );
    });
    describe('심볼 데이터 수급(ensureSymbolData)은', () => {
        /**
         * 게이트는 실행부가 일괄로 걸지 않고 **툴이 직접 부른다**. 실행부의
         * 책임은 "턴당 심볼별 1회로 접히고 절대 reject하지 않는" 함수를 만들어
         * runtime에 실어 주는 것뿐이다.
         */
        function capture(): {
            exec: ReturnType<typeof createToolExecutor>;
            runtimes: ToolRuntime[];
        } {
            const runtimes: ToolRuntime[] = [];
            search.mockImplementation(
                async (_args: unknown, _ctx: unknown, runtime: ToolRuntime) => {
                    runtimes.push(runtime);
                    return { ok: true };
                }
            );
            return {
                exec: createToolExecutor({ analysisModel: 'm' as never }),
                runtimes,
            };
        }

        it('툴에 ensureSymbolData를 넘긴다', async () => {
            const { exec, runtimes } = capture();

            await exec('search_ticker', { query: 'a' }, makeCtx());

            expect(typeof runtimes[0]!.ensureSymbolData).toBe('function');
        });

        it('같은 턴에서 같은 심볼은 한 번만 수급한다', async () => {
            ensureSymbolNewsFresh.mockResolvedValue({
                refreshed: true,
                changedCount: 0,
            });
            const { exec, runtimes } = capture();
            await exec('search_ticker', { query: 'a' }, makeCtx());

            await runtimes[0]!.ensureSymbolData('LAES');
            await runtimes[0]!.ensureSymbolData('laes');

            expect(ensureSymbolNewsFresh).toHaveBeenCalledOnce();
            expect(ensureSymbolNewsFresh).toHaveBeenCalledWith('LAES');
        });

        it('턴이 다르면 다시 수급한다', async () => {
            ensureSymbolNewsFresh.mockResolvedValue({
                refreshed: true,
                changedCount: 0,
            });
            const a = capture();
            await a.exec('search_ticker', { query: 'a' }, makeCtx());
            const b = capture();
            await b.exec('search_ticker', { query: 'a' }, makeCtx());

            await a.runtimes[0]!.ensureSymbolData('LAES');
            await b.runtimes[0]!.ensureSymbolData('LAES');

            expect(ensureSymbolNewsFresh).toHaveBeenCalledTimes(2);
        });

        /**
         * 거절을 캐시에 남기면 한 번의 실패가 그 턴의 해당 심볼 전체를 오염시켜,
         * 이후 모든 툴이 같은 rejected promise를 다시 await한다.
         */
        it('수급이 실패해도 reject하지 않고, 같은 턴의 다음 호출도 오염되지 않는다', async () => {
            const errorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});
            ensureSymbolNewsFresh.mockRejectedValue(new Error('boom'));
            const { exec, runtimes } = capture();
            await exec('search_ticker', { query: 'a' }, makeCtx());

            await expect(
                runtimes[0]!.ensureSymbolData('LAES')
            ).resolves.toBeUndefined();
            await expect(
                runtimes[0]!.ensureSymbolData('LAES')
            ).resolves.toBeUndefined();

            errorSpy.mockRestore();
        });
    });
});
