const { mockCreateExecutor, mockExecute, mockByok, mockAgentTool } = vi.hoisted(
    () => ({
        mockCreateExecutor: vi.fn(),
        mockExecute: vi.fn(),
        mockByok: vi.fn(),
        mockAgentTool: vi.fn(),
    })
);
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    createToolExecutor: mockCreateExecutor,
    availableToolNames: () => new Set(),
}));
vi.mock('@/app/api/v1/runByokFreshAnalysis', () => ({
    runByokFreshAnalysis: mockByok,
}));
// 서버 키로 LLM을 부르는 에이전트 구현 — 공개 API 경로에서 불리면 안 된다.
vi.mock('@/app/api/ai/chat/tools/runFreshAnalysis', () => ({
    runFreshAnalysisTool: mockAgentTool,
}));
vi.mock('@/entities/llm-provider/api/agent/router', () => ({
    AGENT_MODEL: 'agent-model-for-test',
}));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    TOOL_TIMEOUT_MS: { free: 25, cached: 25, external: 25, expensive: 25 },
}));

import { findToolSpec } from '@y0ngha/siglens-core';
import { executePublicTool } from '@/app/api/v1/executePublicTool';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';
import { isServerLlmAllowed } from '@/shared/lib/serverLlmPolicy';

const spec = findToolSpec('run_fresh_analysis')!;
const principal: ApiKeyPrincipal = {
    keyId: 'key-a',
    keyName: 'A',
    keyPrefix: 'slk_aaaaaa',
    userId: 'user-a',
    tier: 'pro',
};
const run = (
    args: Record<string, unknown> = { symbol: 'AAPL', kind: 'technical' },
    signal: AbortSignal = new AbortController().signal
) => executePublicTool(spec, args, principal, 'ja', signal);

beforeEach(() => {
    vi.clearAllMocks();
    mockByok.mockResolvedValue({
        ok: true,
        data: { found: true },
        truncated: false,
        meta: { source: 'cache', model: 'claude-opus-5' },
    });
});

describe('executePublicTool — run_fresh_analysis', () => {
    it('서버 키 LLM(회사명 번역 등)을 막은 흐름 안에서 BYOK 구현을 부른다', async () => {
        const seen: boolean[] = [];
        mockByok.mockImplementation(async () => {
            seen.push(isServerLlmAllowed());
            await Promise.resolve();
            seen.push(isServerLlmAllowed());
            return {
                ok: true,
                data: {},
                truncated: false,
                meta: { source: 'cache', model: 'claude-opus-5' },
            };
        });
        await run();
        expect(seen).toEqual([false, false]);
        expect(isServerLlmAllowed()).toBe(true);
    });

    it('BYOK 전용 구현으로만 보낸다: 에이전트 실행기·createToolExecutor는 만들지도 않는다', async () => {
        const result = await run();

        expect(result).toMatchObject({
            ok: true,
            meta: { source: 'cache' },
        });
        expect(mockByok).toHaveBeenCalledTimes(1);
        expect(mockCreateExecutor).not.toHaveBeenCalled();
        expect(mockExecute).not.toHaveBeenCalled();
        expect(mockAgentTool).not.toHaveBeenCalled();
    });

    it('인자·principal·요청 locale을 그대로 넘긴다(userId는 principal에서만)', async () => {
        await run({ symbol: 'AAPL', kind: 'news', model: 'claude-opus-5' });
        expect(mockByok).toHaveBeenCalledWith({
            args: { symbol: 'AAPL', kind: 'news', model: 'claude-opus-5' },
            principal,
            locale: 'ja',
            signal: expect.any(AbortSignal),
        });
    });

    it('구현이 돌려준 오류(헤더·details 포함)를 그대로 전달한다', async () => {
        mockByok.mockResolvedValue({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            message: 'No key.',
            details: { provider: 'anthropic' },
        });
        await expect(run()).resolves.toEqual({
            ok: false,
            status: 400,
            code: 'byok_key_required',
            message: 'No key.',
            details: { provider: 'anthropic' },
        });
    });

    it('마감 시간을 넘기면 504 tool_timeout이다', async () => {
        mockByok.mockImplementation(() => new Promise(() => undefined));
        await expect(run()).resolves.toMatchObject({
            ok: false,
            status: 504,
            code: 'tool_timeout',
        });
    });

    it('클라이언트가 끊으면 504 aborted이다', async () => {
        mockByok.mockImplementation(() => new Promise(() => undefined));
        const controller = new AbortController();
        const pending = run(
            { symbol: 'AAPL', kind: 'technical' },
            controller.signal
        );
        controller.abort();
        await expect(pending).resolves.toMatchObject({
            ok: false,
            status: 504,
            code: 'aborted',
        });
    });

    it('스트림 결과는 그대로 전달하되, 시작 뒤에도 마감이 이기면 tool_timeout으로 닫는다', async () => {
        mockByok.mockResolvedValue({
            streaming: true,
            completion: new Promise(() => undefined),
        });
        const result = await run();
        if (!('streaming' in result)) throw new Error('expected stream');
        await expect(result.completion).resolves.toMatchObject({
            ok: false,
            status: 504,
            code: 'tool_timeout',
        });
    });

    it('스트림 결과는 클라이언트가 끊으면 aborted로 닫는다', async () => {
        mockByok.mockResolvedValue({
            streaming: true,
            completion: new Promise(() => undefined),
        });
        const controller = new AbortController();
        const result = await run(
            { symbol: 'AAPL', kind: 'technical' },
            controller.signal
        );
        if (!('streaming' in result)) throw new Error('expected stream');
        controller.abort();
        await expect(result.completion).resolves.toMatchObject({
            ok: false,
            code: 'aborted',
        });
    });

    it('끝난 completion은 그대로 전달한다', async () => {
        mockByok.mockResolvedValue({
            streaming: true,
            completion: Promise.resolve({
                ok: true,
                data: { found: true },
                truncated: false,
            }),
        });
        const result = await run();
        if (!('streaming' in result)) throw new Error('expected stream');
        await expect(result.completion).resolves.toMatchObject({ ok: true });
    });

    it('runByokFreshAnalysis에 합쳐진 signal을 넘긴다(끊김·마감이 core까지 닿는다)', async () => {
        await run();
        expect(mockByok.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    });

    it('스트림 시작 헤더(X-RateLimit-AI-*)를 마감 경쟁을 거친 결과에도 유지한다', async () => {
        mockByok.mockResolvedValue({
            streaming: true,
            headers: { 'X-RateLimit-AI-Remaining': '3' },
            completion: Promise.resolve({
                ok: true,
                data: {},
                truncated: false,
            }),
        });
        const result = await run();
        if (!('streaming' in result)) throw new Error('expected stream');
        expect(result.headers).toEqual({ 'X-RateLimit-AI-Remaining': '3' });
    });
});
