import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspect } from 'node:util';

const { search, getOptionsSummary } = vi.hoisted(() => ({
    search: vi.fn(),
    getOptionsSummary: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/searchTicker', () => ({
    searchTickerTool: search,
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
    getOptionsSummaryTool: getOptionsSummary,
}));
vi.mock('@/app/api/ai/chat/tools/getMyPortfolio', () => ({
    getMyPortfolioTool: vi.fn(),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: () => false }));

import {
    availableToolNames,
    createToolExecutor,
} from '@/app/api/ai/chat/tools';

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

    it('P1 가용 툴 7종(web_search는 키 있을 때만)', () => {
        expect([...availableToolNames()].sort()).toEqual([
            'get_bars_indicators',
            'get_cached_analysis',
            'get_my_portfolio',
            'get_news',
            'get_options_summary',
            'get_quote',
            'search_ticker',
        ]);
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
});
