import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AgentTurnError,
    agentEventStream,
} from '@/app/api/ai/chat/agentEventStream';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';
import {
    __activeStreamCount,
    __resetActiveStreamsForTests,
} from '@/shared/lib/sse/activeStreams';

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string[]> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value);
    }
    return buf.split('\n\n').filter(Boolean);
}

describe('agentEventStream', () => {
    beforeEach(() => __resetActiveStreamsForTests());

    it('meta → 이벤트 → done, 활성 스트림 등록·해제', async () => {
        const frames = await readAll(
            agentEventStream({
                meta: { conversationId: 'c1' },
                work: async emit => {
                    expect(__activeStreamCount()).toBe(1);
                    emit({ type: 'text', delta: 'hi' });
                    return { assistantMessageId: 'm2' };
                },
                onAbort: vi.fn(),
            })
        );
        expect(frames).toEqual([
            'event: meta\ndata: {"conversationId":"c1"}',
            'event: text\ndata: {"delta":"hi"}',
            'event: done\ndata: {"assistantMessageId":"m2"}',
        ]);
        expect(__activeStreamCount()).toBe(0);
    });

    it('AgentTurnError → error 프레임에 그 code, console.warn(에러 아님)', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(
            (
                await readAll(
                    agentEventStream({
                        meta: {},
                        work: async () => {
                            throw new AgentTurnError('turn_limit');
                        },
                        onAbort: vi.fn(),
                    })
                )
            ).at(-1)
        ).toBe(
            'event: error\ndata: {"code":"turn_limit","message":"turn_limit"}'
        );
        // Ordinary domain outcomes (quota/stop) must not hit the CloudWatch
        // `[agent-stream] failed:` alarm marker — only console.warn.
        expect(err).not.toHaveBeenCalled();
        expect(
            warn.mock.calls.some(c => c[0] === '[agent-stream] turn failed:')
        ).toBe(true);
        warn.mockRestore();
        err.mockRestore();
    });

    it('일반 예외(비 AgentTurnError) → server_error 프레임 + console.error(알람 마커), 원본 메시지는 프레임에 없다', async () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const sensitive = new Error(
            "SELECT * FROM chat_messages WHERE user_id = 'u-11111111-2222-3333-4444-555555555555'"
        );
        const frames = await readAll(
            agentEventStream({
                meta: {},
                work: async () => {
                    throw sensitive;
                },
                onAbort: vi.fn(),
            })
        );
        const errorFrame = frames.at(-1)!;
        expect(errorFrame).toBe(
            'event: error\ndata: {"code":"server_error","message":"server_error"}'
        );
        // The raw DB error (SQL + bound userId) must never reach the client frame.
        expect(errorFrame).not.toContain('SELECT');
        expect(errorFrame).not.toContain(
            'u-11111111-2222-3333-4444-555555555555'
        );
        expect(warn).not.toHaveBeenCalled();
        expect(
            err.mock.calls.some(
                c => c[0] === '[agent-stream] failed:' && c[1] === sensitive
            )
        ).toBe(true);
        err.mockRestore();
        warn.mockRestore();
    });

    it('cancel: onAbort는 즉시, 활성 스트림 해제는 work가 settle될 때까지 미룬다(진행 중인 partial-save가 drain 0으로 죽지 않게)', async () => {
        const onAbort = vi.fn();
        let resolveWork!: (v: { ok: true }) => void;
        const stream = agentEventStream({
            meta: {},
            work: () =>
                new Promise<{ ok: true }>(resolve => (resolveWork = resolve)),
            onAbort,
        });
        const reader = stream.getReader();
        await reader.read();
        await reader.cancel();
        expect(onAbort).toHaveBeenCalledTimes(1);
        // Not released yet — the caller's `work` (e.g. the partial-save INSERT) is still in flight.
        expect(__activeStreamCount()).toBe(1);
        resolveWork({ ok: true });
        await Promise.resolve();
        await Promise.resolve();
        expect(__activeStreamCount()).toBe(0);
    });

    describe('heartbeat (fake timers)', () => {
        beforeEach(() => vi.useFakeTimers());
        afterEach(() => vi.useRealTimers());

        it('턴이 실행 중인 동안 HEARTBEAT_INTERVAL_MS마다 heartbeat 프레임을 내보내고, 완료 시 정리한다', async () => {
            let resolveWork!: (v: { ok: true }) => void;
            const stream = agentEventStream({
                meta: {},
                work: () =>
                    new Promise<{ ok: true }>(
                        resolve => (resolveWork = resolve)
                    ),
                onAbort: vi.fn(),
            });
            const reader = stream.getReader();
            await reader.read(); // meta

            const framesRead = async (n: number): Promise<string[]> => {
                const out: string[] = [];
                for (let i = 0; i < n; i++) {
                    const { value } = await reader.read();
                    out.push(new TextDecoder().decode(value));
                }
                return out;
            };

            const p1 = framesRead(1);
            await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
            expect((await p1)[0]).toBe('event: heartbeat\ndata: {}\n\n');

            const p2 = framesRead(1);
            await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
            expect((await p2)[0]).toBe('event: heartbeat\ndata: {}\n\n');

            const clearSpy = vi.spyOn(global, 'clearInterval');
            resolveWork({ ok: true });
            await vi.advanceTimersByTimeAsync(0);
            expect(clearSpy).toHaveBeenCalled();
            const remaining = await reader.read();
            expect(new TextDecoder().decode(remaining.value)).toContain(
                'event: done'
            );
            // Stream closes right after `done` — no more heartbeats fire after completion.
            await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
            const closedRead = await reader.read();
            expect(closedRead.done).toBe(true);
            clearSpy.mockRestore();
        });

        it('턴 실패 시에도 heartbeat 인터벌을 정리한다', async () => {
            const clearSpy = vi.spyOn(global, 'clearInterval');
            const stream = agentEventStream({
                meta: {},
                work: async () => {
                    throw new AgentTurnError('server_error');
                },
                onAbort: vi.fn(),
            });
            const reader = stream.getReader();
            await reader.read(); // meta
            await vi.advanceTimersByTimeAsync(0);
            await reader.read(); // error frame
            expect(clearSpy).toHaveBeenCalled();
            clearSpy.mockRestore();
        });
    });

    it('cancel 이후 controller.enqueue 시도는 조용히 무시된다(닫힌 controller에 쓰지 않는다)', async () => {
        let emitLate!: (event: { type: 'text'; delta: string }) => void;
        const stream = agentEventStream({
            meta: {},
            work: async emit => {
                emitLate = emit;
                return new Promise(() => {}) as unknown as Promise<{
                    ok: true;
                }>;
            },
            onAbort: vi.fn(),
        });
        const reader = stream.getReader();
        await reader.read();
        await reader.cancel();
        expect(() => emitLate({ type: 'text', delta: 'late' })).not.toThrow();
    });
});
