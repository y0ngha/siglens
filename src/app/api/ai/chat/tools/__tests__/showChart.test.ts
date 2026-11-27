vi.mock('server-only', () => ({}));

const resolveAssetInfoOrNull = vi.hoisted(() => vi.fn());
vi.mock('@/app/api/ai/chat/tools/resolveAssetInfo', () => ({
    resolveAssetInfoOrNull,
}));

const b = vi.hoisted(() => ({
    compare: vi.fn(),
    financials: vi.fn(),
    options: vi.fn(),
    flows: vi.fn(),
    portfolio: vi.fn(),
    heatmap: vi.fn(),
    dividends: vi.fn(),
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/compare', () => ({
    COMPARE_DEFAULT_PERIOD: '6M',
    buildCompareBlock: b.compare,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/financials', () => ({
    buildFinancialsBlock: b.financials,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/options', () => ({
    buildOptionsBlock: b.options,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/flows', () => ({
    buildFlowsBlock: b.flows,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/portfolio', () => ({
    buildPortfolioBlock: b.portfolio,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/heatmap', () => ({
    buildHeatmapBlock: b.heatmap,
}));
vi.mock('@/app/api/ai/chat/tools/visualBlocks/dividends', () => ({
    buildDividendsBlock: b.dividends,
}));

import type { ToolExecutionContext } from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolRuntime } from '@/app/api/ai/chat/tools/chatTools';
import {
    SHOW_CHART_NAME_TIMEOUT_MS,
    SHOW_CHART_TIMEOUT_MS,
    showChartTool,
} from '@/app/api/ai/chat/tools/showChart';
import type { ChatVisualBlock } from '@/entities/chat-conversation/types';

const ctx = (userId = 'user-1'): ToolExecutionContext => ({
    userId,
    tier: 'member',
    locale: 'ko',
    signal: new AbortController().signal,
});

const emitChart = vi.fn();
const runtime = (over: Partial<ToolRuntime> = {}): ToolRuntime => ({
    analysisModel: 'deepseek-v4.1-flash' as never,
    ensureSymbolData: async () => {},
    emitChart,
    ...over,
});

const block: ChatVisualBlock = {
    version: 1,
    kind: 'dividends',
    asOf: '2026-11-19T00:00:00.000Z',
    symbol: 'KO',
    currency: 'USD',
    years: [{ year: 2026, amount: 1, partial: true }],
};
const built = { block, summary: { symbol: 'KO' } };

const run = (args: Record<string, unknown>, c = ctx(), rt = runtime()) =>
    showChartTool(args, c, rt);

beforeEach(() => {
    Object.values(b).forEach(fn => fn.mockReset());
    emitChart.mockReset();
    resolveAssetInfoOrNull.mockReset().mockResolvedValue(null);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.useRealTimers());

describe('showChartTool — 성공', () => {
    it('블록을 emitChart로 넘기고 모델에는 rendered·kind·summary만 준다', async () => {
        b.dividends.mockResolvedValue(built);
        const result = await run({ kind: 'dividends', symbol: 'ko' });
        expect(result).toEqual({
            rendered: true,
            kind: 'dividends',
            summary: { symbol: 'KO' },
        });
        expect(b.dividends).toHaveBeenCalledWith('KO', expect.anything());
        const pending = emitChart.mock.calls.map(([p]) => p);
        expect(pending).toHaveLength(1);
        await expect(Promise.all(pending)).resolves.toEqual([block]);
    });

    it('환경: 로케일·사용자·비공식 소스 허용 여부를 빌더에 넘긴다', async () => {
        b.flows.mockResolvedValue(built);
        await run(
            { kind: 'flows', symbol: '005930.KS' },
            ctx('u9'),
            runtime({ allowUnofficialSources: false })
        );
        expect(b.flows).toHaveBeenCalledWith(
            '005930.KS',
            expect.objectContaining({
                locale: 'ko',
                userId: 'u9',
                allowUnofficialSources: false,
            })
        );
    });
});

describe('showChartTool — 종류별 라우팅', () => {
    it.each([
        [
            'financials',
            'financials',
            { kind: 'financials', symbol: 'aapl' },
            ['AAPL'],
        ],
        ['flows', 'flows', { kind: 'flows', symbol: 'nvda' }, ['NVDA']],
        [
            'options 기본 만기',
            'options',
            { kind: 'options', symbol: 'tsla' },
            ['TSLA', null],
        ],
        [
            'options 지정 만기',
            'options',
            { kind: 'options', symbol: 'tsla', expiry: '2026-12-18' },
            ['TSLA', '2026-12-18'],
        ],
        [
            'options 잘못된 만기 형식은 무시',
            'options',
            { kind: 'options', symbol: 'tsla', expiry: 'next friday' },
            ['TSLA', null],
        ],
        ['heatmap 기본', 'heatmap', { kind: 'heatmap' }, ['us', null]],
        [
            'heatmap 한국',
            'heatmap',
            { kind: 'heatmap', market: 'kr' },
            ['kr', null],
        ],
        [
            'heatmap 테마',
            'heatmap',
            { kind: 'heatmap', theme: 'ai_semis' },
            ['us', 'ai_semis'],
        ],
    ])('%s', async (_label, builder, args, expected) => {
        const fn = b[builder as keyof typeof b];
        fn.mockResolvedValue(built);
        await run(args);
        expect(
            fn.mock.calls.map(call => call.slice(0, expected.length))
        ).toEqual([expected]);
    });

    it('compare: 대문자·중복 제거 후 기간 기본값은 6M', async () => {
        b.compare.mockResolvedValue(built);
        await run({ kind: 'compare', symbols: ['nvda', 'AMD', 'NVDA'] });
        await run({ kind: 'compare', symbols: ['a', 'b'], period: '1Y' });
        expect(b.compare.mock.calls.map(call => call.slice(0, 2))).toEqual([
            [['NVDA', 'AMD'], '6M'],
            [['A', 'B'], '1Y'],
        ]);
    });
});

describe('showChartTool — 인자 검증', () => {
    it.each([
        ['한 종목', ['AAPL']],
        ['중복으로 한 종목', ['AAPL', 'aapl']],
        ['6종목', ['A', 'B', 'C', 'D', 'E', 'F']],
        ['목록 아님', 'AAPL,MSFT'],
        ['빈 값', ['', ' ']],
    ])(
        'compare %s → invalid_args(빌더를 부르지 않는다)',
        async (_label, symbols) => {
            expect(await run({ kind: 'compare', symbols })).toMatchObject({
                error: 'invalid_args',
            });
            expect(b.compare).not.toHaveBeenCalled();
            expect(emitChart).not.toHaveBeenCalled();
        }
    );

    it.each(['financials', 'options', 'flows', 'dividends'])(
        '%s는 symbol이 필요하다',
        async kind => {
            expect(await run({ kind })).toMatchObject({
                error: 'invalid_args',
            });
        }
    );

    it('모르는 kind → invalid_args', async () => {
        expect(await run({ kind: 'pie' })).toMatchObject({
            error: 'invalid_args',
        });
        expect(await run({})).toMatchObject({ error: 'invalid_args' });
    });
});

describe('showChartTool — 회원 전용·거절', () => {
    it('게스트의 portfolio는 login_required(빌더를 부르지 않는다)', async () => {
        expect(await run({ kind: 'portfolio' }, ctx('guest:abc'))).toEqual({
            error: 'login_required',
        });
        expect(b.portfolio).not.toHaveBeenCalled();
    });

    it('게스트도 portfolio 외 kind는 쓴다', async () => {
        b.dividends.mockResolvedValue(built);
        expect(
            await run({ kind: 'dividends', symbol: 'KO' }, ctx('guest:abc'))
        ).toMatchObject({ rendered: true });
    });

    it('회원의 portfolio는 사용자 id로 빌더를 부른다', async () => {
        b.portfolio.mockResolvedValue({ block, summary: {} });
        expect(await run({ kind: 'portfolio' })).toMatchObject({
            rendered: true,
        });
        expect(b.portfolio).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'user-1' })
        );
    });

    it('빌더가 no_data를 주면 그대로 모델에 주고 블록은 내지 않는다', async () => {
        b.dividends.mockResolvedValue({
            error: 'no_data',
            reason: 'no_dividends_paid',
        });
        expect(await run({ kind: 'dividends', symbol: 'TSLA' })).toEqual({
            error: 'no_data',
            reason: 'no_dividends_paid',
        });
        expect(emitChart).not.toHaveBeenCalled();
    });

    it('emitChart가 없는 실행(공개 API 등)은 데이터를 읽기 전에 거절한다', async () => {
        expect(
            await run(
                { kind: 'dividends', symbol: 'KO' },
                ctx(),
                runtime({ emitChart: undefined })
            )
        ).toMatchObject({ error: 'no_data' });
        expect(b.dividends).not.toHaveBeenCalled();
    });
});

describe('showChartTool — 실패 처리', () => {
    it('빌더가 던져도 던지지 않고 no_data(load_failed)', async () => {
        b.financials.mockRejectedValue(new Error('fmp 500'));
        expect(await run({ kind: 'financials', symbol: 'AAPL' })).toEqual({
            error: 'no_data',
            reason: 'load_failed',
        });
        expect(emitChart).not.toHaveBeenCalled();
    });

    it(`${SHOW_CHART_TIMEOUT_MS}ms를 넘기면 포기하고 no_data(timeout)`, async () => {
        vi.useFakeTimers();
        b.options.mockReturnValue(new Promise(() => undefined));
        const pending = run({ kind: 'options', symbol: 'TSLA' });
        await vi.advanceTimersByTimeAsync(SHOW_CHART_TIMEOUT_MS + 1);
        expect(await pending).toEqual({ error: 'no_data', reason: 'timeout' });
        expect(emitChart).not.toHaveBeenCalled();
    });

    it('직렬화 50KB를 넘는 블록은 내보내지 않는다', async () => {
        b.dividends.mockResolvedValue({
            block: {
                ...block,
                years: Array.from({ length: 6000 }, (_, i) => ({
                    year: 2000 + i,
                    amount: 1.23456,
                    partial: false,
                })),
            },
            summary: {},
        });
        expect(await run({ kind: 'dividends', symbol: 'KO' })).toEqual({
            error: 'no_data',
            reason: 'block_too_large',
        });
        expect(emitChart).not.toHaveBeenCalled();
    });
});

describe('showChartTool — 클라이언트 가드', () => {
    it.each([Number.NaN, undefined])(
        '숫자 필드가 %s인 블록은 내보내지 않고 no_data(invalid_block)',
        async amount => {
            b.dividends.mockResolvedValue({
                block: {
                    ...block,
                    years: [{ year: 2026, amount, partial: true }],
                },
                summary: {},
            });
            expect(await run({ kind: 'dividends', symbol: 'KO' })).toEqual({
                error: 'no_data',
                reason: 'invalid_block',
            });
            expect(emitChart).not.toHaveBeenCalled();
        }
    );
});

describe('showChartTool — 크기 상한은 바이트', () => {
    it('UTF-16 길이로는 50KB 미만이어도 UTF-8 바이트로 넘으면 내보내지 않는다', async () => {
        b.dividends.mockResolvedValue(built);
        // 한글 2만 자 = 길이 2만(<50,000)이지만 6만 바이트(>50,000).
        resolveAssetInfoOrNull.mockResolvedValue({
            symbol: 'KO',
            name: 'Coca-Cola',
            koreanName: '가'.repeat(20_000),
        });
        expect(await run({ kind: 'dividends', symbol: 'KO' })).toEqual({
            error: 'no_data',
            reason: 'block_too_large',
        });
        expect(emitChart).not.toHaveBeenCalled();
    });
});

describe('showChartTool — 제목용 회사 이름', () => {
    const emitted = async () =>
        Promise.all(emitChart.mock.calls.map(([pending]) => pending));

    it('기본 로케일(한국어) 답변이면 한글명을 블록에 붙인다', async () => {
        b.dividends.mockResolvedValue(built);
        resolveAssetInfoOrNull.mockResolvedValue({
            symbol: 'KO',
            name: 'The Coca-Cola Company',
            koreanName: '코카콜라',
        });
        await run({ kind: 'dividends', symbol: 'KO' });
        expect(resolveAssetInfoOrNull).toHaveBeenCalledWith('KO', 'show_chart');
        await expect(emitted()).resolves.toEqual([
            { ...block, name: '코카콜라' },
        ]);
    });

    it('다른 로케일이면 영문명을, 한글명이 없으면 영문명을 쓴다', async () => {
        b.dividends.mockResolvedValue(built);
        resolveAssetInfoOrNull.mockResolvedValue({
            symbol: 'KO',
            name: 'The Coca-Cola Company',
            koreanName: '코카콜라',
        });
        await run(
            { kind: 'dividends', symbol: 'KO' },
            { ...ctx(), locale: 'en' }
        );
        resolveAssetInfoOrNull.mockResolvedValue({
            symbol: 'KO',
            name: 'Coca-Cola',
        });
        await run({ kind: 'dividends', symbol: 'KO' });
        await expect(emitted()).resolves.toEqual([
            { ...block, name: 'The Coca-Cola Company' },
            { ...block, name: 'Coca-Cola' },
        ]);
    });

    it(`이름 조회가 ${SHOW_CHART_NAME_TIMEOUT_MS}ms를 넘겨 멈춰도 이름 없는 블록을 내보낸다`, async () => {
        vi.useFakeTimers();
        b.dividends.mockResolvedValue(built);
        resolveAssetInfoOrNull.mockReturnValue(new Promise(() => undefined));
        const pending = run({ kind: 'dividends', symbol: 'KO' });
        await vi.advanceTimersByTimeAsync(SHOW_CHART_NAME_TIMEOUT_MS + 1);
        expect(await pending).toEqual({
            rendered: true,
            kind: 'dividends',
            summary: { symbol: 'KO' },
        });
        await expect(emitted()).resolves.toEqual([block]);
    });

    it('자산 정보를 못 읽으면 이름 없이 그린다', async () => {
        b.dividends.mockResolvedValue(built);
        await run({ kind: 'dividends', symbol: 'KO' });
        await expect(emitted()).resolves.toEqual([block]);
    });

    it('종목 하나가 아닌 블록(비교)은 이름을 찾지 않는다', async () => {
        b.compare.mockResolvedValue({
            block: {
                version: 1,
                kind: 'compare',
                asOf: '2026-11-19T00:00:00.000Z',
                period: '6M',
                series: [],
            },
            summary: {},
        });
        await run({ kind: 'compare', symbols: ['NVDA', 'AMD'] });
        expect(resolveAssetInfoOrNull).not.toHaveBeenCalled();
    });
});
