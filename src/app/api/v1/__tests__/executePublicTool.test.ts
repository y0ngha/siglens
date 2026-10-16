const { mockCreateExecutor, mockExecute, mockChartData } = vi.hoisted(() => ({
    mockCreateExecutor: vi.fn(),
    mockExecute: vi.fn(),
    mockChartData: vi.fn(),
}));
vi.mock('@/app/api/v1/getChartData', () => ({
    getChartDataTool: mockChartData,
}));
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    createToolExecutor: mockCreateExecutor,
    availableToolNames: () => new Set(),
}));
vi.mock('@/entities/llm-provider/api/agent/router', () => ({
    AGENT_MODEL: 'agent-model-for-test',
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    // 마감 시간을 짧게 줄여 타임아웃 경로를 실제 타이머로 태운다.
    TOOL_TIMEOUT_MS: { free: 25, cached: 25, external: 25, expensive: 25 },
}));

import { findToolSpec } from '@y0ngha/siglens-core';
import { CHART_DATA_TOOL_SPEC } from '@/app/api/v1/chartDataToolSpec';
import {
    executePublicTool,
    resolveApiLocale,
} from '@/app/api/v1/executePublicTool';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { PUBLIC_API_RESULT_CAPS } from '@/shared/config/publicApi';
import { isServerLlmAllowed } from '@/shared/lib/serverLlmPolicy';

const spec = findToolSpec('get_quote')!;
const principal: ApiKeyPrincipal = {
    keyId: 'key-a',
    keyName: 'A',
    keyPrefix: 'slk_aaaaaa',
    userId: 'user-a',
    tier: 'pro',
};
const run = (
    args: Record<string, unknown> = { symbols: ['AAPL'] },
    signal: AbortSignal = new AbortController().signal
) => executePublicTool(spec, args, principal, 'ja', signal);

beforeEach(() => {
    vi.clearAllMocks();
    mockCreateExecutor.mockReturnValue(mockExecute);
    mockExecute.mockResolvedValue({ quotes: [] });
});

describe('executePublicTool — 실행 문맥', () => {
    it('userId·tier는 principal에서, locale은 요청에서 온다', async () => {
        await run();
        expect(mockExecute).toHaveBeenCalledTimes(1);
        const [name, args, ctx] = mockExecute.mock.calls[0];
        expect(name).toBe('get_quote');
        expect(args).toEqual({ symbols: ['AAPL'] });
        expect(ctx).toMatchObject({
            userId: 'user-a',
            tier: 'pro',
            locale: 'ja',
        });
        expect(ctx.signal).toBeInstanceOf(AbortSignal);
    });

    it('tier는 키 소유자의 값을 그대로 넘긴다(고정값이 아니다)', async () => {
        for (const tier of ['free', 'member', 'pro'] as const) {
            mockExecute.mockClear();
            await executePublicTool(
                spec,
                { symbols: ['AAPL'] },
                { ...principal, tier },
                'en',
                new AbortController().signal
            );
            expect(mockExecute.mock.calls[0][2]).toMatchObject({ tier });
        }
    });

    it('에이전트와 같은 분석 모델(AGENT_MODEL)로, 서버 비용 경로는 끄고 API 전용 결과 상한으로 실행기를 만든다', async () => {
        await run();
        expect(mockCreateExecutor).toHaveBeenCalledWith(
            { analysisModel: 'agent-model-for-test' },
            { refreshSymbolData: false, resultCaps: PUBLIC_API_RESULT_CAPS }
        );
    });

    it('데이터 도구도 서버 키 LLM(회사명 번역 등)을 막은 흐름 안에서 실행한다', async () => {
        const seen: boolean[] = [];
        mockExecute.mockImplementation(async () => {
            seen.push(isServerLlmAllowed());
            await Promise.resolve();
            seen.push(isServerLlmAllowed());
            return { quotes: [] };
        });
        await run();
        expect(seen).toEqual([false, false]);
        // 감싼 흐름 밖(웹·에이전트)은 그대로 허용이다.
        expect(isServerLlmAllowed()).toBe(true);
    });

    it('요청마다 새 실행기를 만든다(턴 상태가 요청 사이에 새지 않는다)', async () => {
        await run();
        await run();
        expect(mockCreateExecutor).toHaveBeenCalledTimes(2);
    });

    it('성공 결과는 그대로 data로 돌려준다', async () => {
        mockExecute.mockResolvedValue({ quotes: [{ symbol: 'AAPL' }] });
        await expect(run()).resolves.toEqual({
            ok: true,
            data: { quotes: [{ symbol: 'AAPL' }] },
            truncated: false,
        });
    });

    it('error 필드가 없는 결과(found:false 등)는 오류로 보지 않는다', async () => {
        mockExecute.mockResolvedValue({ found: false });
        await expect(run()).resolves.toEqual({
            ok: true,
            data: { found: false },
            truncated: false,
        });
    });

    it('배열 결과도 성공이다', async () => {
        mockExecute.mockResolvedValue([{ symbol: 'AAPL' }]);
        await expect(run()).resolves.toMatchObject({ ok: true });
    });
});

describe('executePublicTool — 잘림 표시', () => {
    it('{ truncated: true, preview } 봉투면 truncated: true', async () => {
        mockExecute.mockResolvedValue({ truncated: true, preview: '{"a":' });
        await expect(run()).resolves.toMatchObject({
            ok: true,
            truncated: true,
        });
    });

    it.each([
        ['preview 없음', { truncated: true }],
        ['truncated가 true가 아님', { truncated: false, preview: 'x' }],
        ['데이터에 우연히 든 비슷한 이름', { items: [], truncatedCount: 2 }],
    ])('%s이면 잘린 것이 아니다', async (_label, value) => {
        mockExecute.mockResolvedValue(value);
        await expect(run()).resolves.toMatchObject({
            ok: true,
            truncated: false,
        });
    });
});

describe('executePublicTool — 실행기 오류 → HTTP', () => {
    it.each([
        ['invalid_symbol', 400],
        ['invalid_args', 400],
        ['invalid_query', 400],
        ['unknown_tool', 404],
        ['login_required', 403],
        ['aborted', 504],
        ['tool_failed', 500],
    ])('%s -> %i', async (code, status) => {
        mockExecute.mockResolvedValue({ error: code });
        await expect(run()).resolves.toMatchObject({
            ok: false,
            status,
            code,
        });
    });

    it('모르는 오류 코드는 500으로 두되 코드는 그대로 싣는다', async () => {
        mockExecute.mockResolvedValue({ error: 'busy', retryAfterSeconds: 60 });
        await expect(run()).resolves.toMatchObject({
            ok: false,
            status: 500,
            code: 'busy',
            details: { retryAfterSeconds: 60 },
        });
    });

    it('추가 필드가 없으면 details를 만들지 않는다', async () => {
        mockExecute.mockResolvedValue({ error: 'tool_failed' });
        const outcome = await run();
        expect(outcome).not.toHaveProperty('details');
    });

    it('error가 문자열이 아니면 오류로 보지 않는다', async () => {
        mockExecute.mockResolvedValue({ error: { nested: true } });
        await expect(run()).resolves.toMatchObject({ ok: true });
    });
});

describe('executePublicTool — 마감과 중단', () => {
    it('도구가 마감 시간을 넘기면 504 tool_timeout', async () => {
        mockExecute.mockImplementation(() => new Promise(() => undefined));
        await expect(run()).resolves.toMatchObject({
            ok: false,
            status: 504,
            code: 'tool_timeout',
        });
    });

    it('클라이언트가 끊으면 504 aborted(타임아웃과 구분)', async () => {
        const controller = new AbortController();
        mockExecute.mockImplementation(() => new Promise(() => undefined));
        const pending = run({ symbols: ['AAPL'] }, controller.signal);
        controller.abort();
        await expect(pending).resolves.toMatchObject({
            ok: false,
            status: 504,
            code: 'aborted',
        });
    });

    it('마감 전에 끝나면 타임아웃으로 바뀌지 않는다', async () => {
        mockExecute.mockResolvedValue({ ok: 1 });
        const outcome = await run();
        await new Promise(resolve => setTimeout(resolve, 40));
        expect(outcome).toEqual({
            ok: true,
            data: { ok: 1 },
            truncated: false,
        });
    });
});

describe('resolveApiLocale', () => {
    const withHeader = (value?: string): Request =>
        new Request('https://siglens.io/api/v1/me', {
            headers: value === undefined ? {} : { 'x-siglens-locale': value },
        });

    it('지원하는 로케일은 그대로', () => {
        expect(resolveApiLocale(withHeader('ko'))).toBe('ko');
        expect(resolveApiLocale(withHeader(' ja '))).toBe('ja');
    });

    it('헤더가 없거나 모르는 값이면 앱 기본 로케일(ko) — 웹이 채운 공유 분석 캐시에 적중하도록', () => {
        expect(resolveApiLocale(withHeader())).toBe('ko');
        expect(resolveApiLocale(withHeader('fr'))).toBe('ko');
        expect(resolveApiLocale(withHeader('KO'))).toBe('ko');
        expect(resolveApiLocale(withHeader('en'))).toBe('en');
    });
});

describe('executePublicTool — get_chart_data (공개 API 전용 도구)', () => {
    const chartArgs = { symbol: 'AAPL', timeframe: '1Day' };
    const runChart = (
        args: Record<string, unknown> = chartArgs,
        signal: AbortSignal = new AbortController().signal,
        tier: ApiKeyPrincipal['tier'] = 'member'
    ) =>
        executePublicTool(
            CHART_DATA_TOOL_SPEC,
            args,
            { ...principal, tier },
            'en',
            signal
        );

    beforeEach(() => {
        mockChartData.mockResolvedValue({ symbol: 'AAPL', bars: 1 });
    });

    it('에이전트 실행기(createToolExecutor)를 거치지 않고 전용 실행기로 간다', async () => {
        await expect(runChart()).resolves.toEqual({
            ok: true,
            data: { symbol: 'AAPL', bars: 1 },
            truncated: false,
        });
        expect(mockChartData).toHaveBeenCalledTimes(1);
        expect(mockCreateExecutor).not.toHaveBeenCalled();
    });

    it('검증된 인자와 principal의 tier를 넘긴다(본문으로 바꿀 수 없다)', async () => {
        const args = { ...chartArgs, indicators: ['rsi'], bars: 20 };
        await runChart(args, undefined, 'free');
        const [calledArgs, ctx] = mockChartData.mock.calls.find(
            ([a]) => a.symbol === 'AAPL'
        )!;
        expect(calledArgs).toEqual(args);
        expect(ctx).toMatchObject({ userId: 'user-a', tier: 'free' });
    });

    it('서버 키 LLM을 막은 흐름 안에서 실행한다', async () => {
        const seen: boolean[] = [];
        mockChartData.mockImplementation(async () => {
            seen.push(isServerLlmAllowed());
            await Promise.resolve();
            seen.push(isServerLlmAllowed());
            return {};
        });
        await runChart();
        expect(seen).toEqual([false, false]);
        expect(isServerLlmAllowed()).toBe(true);
    });

    it('모양이 맞지 않는 심볼은 도구를 부르기 전에 400 invalid_symbol', async () => {
        await expect(
            runChart({ symbol: '../etc/passwd', timeframe: '1Day' })
        ).resolves.toMatchObject({
            ok: false,
            status: 400,
            code: 'invalid_symbol',
        });
        expect(mockChartData).not.toHaveBeenCalled();
    });

    it('timeframe_not_allowed는 403이고 tier·허용 목록을 details로 싣는다', async () => {
        mockChartData.mockResolvedValue({
            error: 'timeframe_not_allowed',
            tier: 'free',
            timeframe: '5Min',
            allowedTimeframes: ['1Day'],
        });
        await expect(runChart()).resolves.toMatchObject({
            ok: false,
            status: 403,
            code: 'timeframe_not_allowed',
            details: { tier: 'free', allowedTimeframes: ['1Day'] },
        });
    });

    it('bars_not_found는 404', async () => {
        mockChartData.mockResolvedValue({ error: 'bars_not_found' });
        await expect(runChart()).resolves.toMatchObject({
            ok: false,
            status: 404,
            code: 'bars_not_found',
        });
    });

    it('도구가 throw하면 내부 상세 없이 500 tool_failed', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockChartData.mockRejectedValue(new Error('secret db detail'));
        const outcome = await runChart();
        expect(outcome).toMatchObject({
            ok: false,
            status: 500,
            code: 'tool_failed',
        });
        expect(JSON.stringify(outcome)).not.toContain('secret db detail');
        logged.mockRestore();
    });

    it('이미 중단된 요청은 도구를 부르지 않고 504 aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            runChart(chartArgs, controller.signal)
        ).resolves.toMatchObject({ ok: false, status: 504, code: 'aborted' });
        expect(mockChartData).not.toHaveBeenCalled();
    });
});
