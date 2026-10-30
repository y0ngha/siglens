import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { runTurn, appendMessages } = vi.hoisted(() => ({
    runTurn: vi.fn(),
    appendMessages: vi.fn(),
}));

vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<object>()),
    runAgentTurn: runTurn,
}));
vi.mock('@/entities/llm-provider/api/agent/getAgentProvider', () => ({
    getAgentProvider: () => vi.fn(),
}));
vi.mock('@/app/api/ai/chat/counters', () => ({
    agentGlobalLimitsFromEnv: () => undefined,
    createAgentCounters: () => ({}),
}));
vi.mock('@/app/api/ai/chat/tools/chatTools', () => ({
    createToolExecutor: () => vi.fn(),
    availableToolNames: () => new Set(['get_quote']),
}));

import { AGENT_MODEL } from '@/entities/llm-provider/api/agent/router';
import { AgentTurnError } from '@/app/api/ai/chat/agentEventStream';
import {
    agentTurnStream,
    appendOrNotFound,
    type AgentTurnStreamParams,
} from '@/app/api/ai/chat/stream/_lib/agentTurnStream';
import type { ReadyTurn } from '@/app/api/ai/chat/stream/_lib/prepareTurn';

const OK_TURN = {
    ok: true,
    assistant: { role: 'assistant', content: 'hi' },
    intermediate: [],
    usage: { steps: 1, ms: 5 },
    stopReason: 'end',
    remaining: { turns: 59, fresh: 6, search: 5 },
    promptVersion: 'v',
    toolsUsed: [],
};

const FK_ERROR = Object.assign(new Error('fk'), { cause: { code: '23503' } });

const memberTurn = (): ReadyTurn => ({
    repo: { appendMessages } as unknown as NonNullable<ReadyTurn['repo']>,
    conversationId: 'c1',
    userMessage: 'q',
    userMessageId: 'u1',
    userMessageSeq: 1,
    history: [],
    portfolioSymbols: [],
});

const start = (
    overrides: Partial<AgentTurnStreamParams> = {}
): {
    stream: ReadableStream<Uint8Array>;
    release: ReturnType<typeof vi.fn>;
} => {
    const release = vi.fn(async () => {});
    const stream = agentTurnStream({
        turn: memberTurn(),
        subject: 'u1',
        guest: false,
        tier: 'member',
        locale: 'ko',
        timeZone: undefined,
        release,
        ...overrides,
    });
    return { stream, release };
};

const readAll = async (stream: ReadableStream<Uint8Array>): Promise<string> =>
    new Response(stream).text();

afterEach(() => vi.restoreAllMocks());

describe('appendOrNotFound', () => {
    const repo = { appendMessages } as unknown as NonNullable<
        ReadyTurn['repo']
    >;

    beforeEach(() => vi.clearAllMocks());

    it('저장 결과를 그대로 돌려준다', async () => {
        appendMessages.mockResolvedValue([{ id: 'm1' }]);
        expect(await appendOrNotFound(repo, 'c1', [])).toEqual([{ id: 'm1' }]);
    });

    it('FK 위반은 AgentTurnError(not_found)로 바꾼다', async () => {
        appendMessages.mockRejectedValue(FK_ERROR);
        await expect(appendOrNotFound(repo, 'c1', [])).rejects.toEqual(
            new AgentTurnError('not_found')
        );
    });

    it('그 밖의 오류는 그대로 던진다', async () => {
        const boom = new Error('db down');
        appendMessages.mockRejectedValue(boom);
        await expect(appendOrNotFound(repo, 'c1', [])).rejects.toBe(boom);
    });
});

describe('agentTurnStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        appendMessages.mockImplementation(async (_c: string, rows: unknown[]) =>
            rows.map((r, i) => ({ ...(r as object), id: `a${i}`, seq: i + 2 }))
        );
        runTurn.mockResolvedValue(OK_TURN);
    });

    it('성공: done 프레임을 보내고 release를 정확히 한 번 부른다', async () => {
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(text).toContain('event: done');
        expect(text).toContain('"assistantMessageId":"a0"');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('부분 답변: 실패 코드에 맞는 상태로 저장하고 에러 프레임을 보낸다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'deadline',
            partialText: '  절반  ',
        });
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(appendMessages).toHaveBeenCalledWith('c1', [
            {
                role: 'assistant',
                content: '절반',
                modelId: AGENT_MODEL,
                status: 'aborted',
            },
        ]);
        expect(text).toContain('"code":"deadline"');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('부분 답변 저장 중 FK 위반이면 not_found 프레임으로 알린다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'aborted',
            partialText: 'x',
        });
        appendMessages.mockRejectedValue(FK_ERROR);
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream } = start();
        const text = await readAll(stream);
        expect(text).toContain('"code":"not_found"');
        expect(text).not.toContain('fk');
    });

    it('게스트는 부분 답변이 있어도 저장하지 않는다', async () => {
        runTurn.mockResolvedValue({
            ok: false,
            error: 'aborted',
            partialText: 'x',
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream } = start({
            turn: { ...memberTurn(), repo: null, conversationId: null },
            guest: true,
        });
        await readAll(stream);
        expect(appendMessages).not.toHaveBeenCalled();
    });

    it('턴이 던지면 server_error 프레임을 보내고 release를 한 번 부른다', async () => {
        runTurn.mockRejectedValue(new Error('provider exploded'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { stream, release } = start();
        const text = await readAll(stream);
        expect(text).toContain('"code":"server_error"');
        expect(text).not.toContain('provider exploded');
        expect(release).toHaveBeenCalledTimes(1);
    });

    it('클라이언트가 끊으면 턴 signal을 중단하고 턴이 끝난 뒤 release를 한 번 부른다', async () => {
        let seenSignal: AbortSignal | undefined;
        runTurn.mockImplementation(
            (input: { signal: AbortSignal }) =>
                new Promise(resolve => {
                    seenSignal = input.signal;
                    input.signal.addEventListener('abort', () =>
                        resolve({ ok: false, error: 'aborted' })
                    );
                })
        );
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { stream, release } = start();
        const reader = stream.getReader();
        await reader.read();
        await reader.cancel();
        await vi.waitFor(() => expect(release).toHaveBeenCalledTimes(1));
        expect(seenSignal?.aborted).toBe(true);
    });
});
