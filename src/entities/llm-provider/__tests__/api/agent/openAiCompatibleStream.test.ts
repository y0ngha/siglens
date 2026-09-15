import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, MockOpenAI } = vi.hoisted(() => {
    const create = vi.fn();
    const MockOpenAI = vi.fn().mockImplementation(function () {
        return { chat: { completions: { create } } };
    });
    return { mockCreate: create, MockOpenAI };
});
vi.mock('openai', () => ({ default: MockOpenAI }));

import {
    AGENT_PROVIDER_STALLED,
    AGENT_STALL_TIMEOUT_MS,
    streamOpenAiCompatibleAgent,
} from '@/entities/llm-provider/api/agent/openAiCompatibleStream';
import type { AgentStreamEvent } from '@y0ngha/siglens-core';

const REQ = { baseURL: 'https://x', messages: [], extraBody: {} };

function opts(signal: AbortSignal) {
    return {
        apiKey: 'k',
        apiModelId: 'm',
        model: 'deepseek-v4.1-flash' as const,
        system: 'sys',
        messages: [{ role: 'user' as const, content: 'q' }],
        tools: [],
        maxOutputTokens: 100,
        signal,
        onEvent: vi.fn<(e: AgentStreamEvent) => void>(),
    };
}

/** Mimics the openai SDK: the request promise rejects once its signal aborts. */
function hangUntilAborted(signal: AbortSignal): Promise<never> {
    return new Promise((_, reject) => {
        signal.addEventListener('abort', () =>
            reject(
                Object.assign(new Error('Request was aborted.'), {
                    name: 'AbortError',
                })
            )
        );
    });
}

describe('streamOpenAiCompatibleAgent stall watchdog', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('응답이 90초간 없으면 AGENT_PROVIDER_STALLED로 reject한다', async () => {
        mockCreate.mockImplementation((_b, { signal }) =>
            hangUntilAborted(signal)
        );
        const p = streamOpenAiCompatibleAgent(
            opts(new AbortController().signal),
            REQ
        );
        const assertion = expect(p).rejects.toMatchObject({
            code: AGENT_PROVIDER_STALLED,
        });
        await vi.advanceTimersByTimeAsync(AGENT_STALL_TIMEOUT_MS);
        await assertion;
    });

    it('청크 사이 침묵이 90초면 SDK가 조용히 끝내도 STALLED로 reject한다', async () => {
        mockCreate.mockImplementation(async (_b, { signal }) =>
            (async function* () {
                yield { choices: [{ delta: { content: 'a' } }] };
                await new Promise(r => signal.addEventListener('abort', r));
            })()
        );
        const o = opts(new AbortController().signal);
        const p = streamOpenAiCompatibleAgent(o, REQ);
        const assertion = expect(p).rejects.toMatchObject({
            code: AGENT_PROVIDER_STALLED,
        });
        await vi.advanceTimersByTimeAsync(AGENT_STALL_TIMEOUT_MS);
        await assertion;
        expect(o.onEvent).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'stop' })
        );
    });

    it('청크마다 타이머를 재무장한다(89초 간격 3청크는 정상 완료)', async () => {
        const gap = AGENT_STALL_TIMEOUT_MS - 1_000;
        mockCreate.mockImplementation(async () =>
            (async function* () {
                for (const c of ['a', 'b', 'c']) {
                    await new Promise(r => setTimeout(r, gap));
                    yield { choices: [{ delta: { content: c } }] };
                }
                yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
            })()
        );
        const p = streamOpenAiCompatibleAgent(
            opts(new AbortController().signal),
            REQ
        );
        await vi.advanceTimersByTimeAsync(gap * 3);
        await expect(p).resolves.toMatchObject({
            text: 'abc',
            stopReason: 'end',
        });
    });

    it('호출자 abort는 STALLED가 아닌 일반 abort로 전파된다', async () => {
        mockCreate.mockImplementation((_b, { signal }) =>
            hangUntilAborted(signal)
        );
        const ac = new AbortController();
        const p = streamOpenAiCompatibleAgent(opts(ac.signal), REQ);
        const assertion = p.then(
            () => {
                throw new Error('resolved');
            },
            (e: unknown) => e
        );
        ac.abort();
        const err = await assertion;
        expect(err).toMatchObject({ name: 'AbortError' });
        expect((err as { code?: string }).code).toBeUndefined();
    });

    it('정상 완료 후 타이머가 남지 않는다', async () => {
        mockCreate.mockResolvedValue(
            (async function* () {
                yield { choices: [{ delta: {}, finish_reason: 'stop' }] };
            })()
        );
        await streamOpenAiCompatibleAgent(
            opts(new AbortController().signal),
            REQ
        );
        expect(vi.getTimerCount()).toBe(0);
    });
});
