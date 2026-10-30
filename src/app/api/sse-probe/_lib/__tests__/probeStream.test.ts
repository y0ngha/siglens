import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProbeStream } from '@/app/api/sse-probe/_lib/probeStream';

const decoder = new TextDecoder();

async function readText(
    reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
    const { value } = await reader.read();
    return value === undefined ? '' : decoder.decode(value);
}

describe('createProbeStream', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('시작하면 retry 힌트와 open 이벤트를 즉시 보낸다', async () => {
        const reader = createProbeStream({
            durationSeconds: 30,
            intervalSeconds: 5,
        }).getReader();

        expect(await readText(reader)).toBe('retry: 10000\n\n');
        expect(await readText(reader)).toBe(
            'event: open\ndata: {"durationSeconds":30,"intervalSeconds":5}\n\n'
        );
        await reader.cancel();
    });

    it('tick에 서버 기준 경과 시간을 싣는다', async () => {
        const reader = createProbeStream({
            durationSeconds: 30,
            intervalSeconds: 5,
        }).getReader();
        await readText(reader);
        await readText(reader);

        vi.advanceTimersByTime(5000);

        expect(await readText(reader)).toBe(
            'event: tick\ndata: {"seq":1,"elapsedMs":5000}\n\n'
        );
        await reader.cancel();
    });

    it('duration이 지난 tick에서 done을 보내고 스트림을 닫는다', async () => {
        const reader = createProbeStream({
            durationSeconds: 1,
            intervalSeconds: 1,
        }).getReader();
        await readText(reader);
        await readText(reader);

        vi.advanceTimersByTime(1000);

        expect(await readText(reader)).toBe(
            'event: done\ndata: {"seq":1,"elapsedMs":1000}\n\n'
        );
        expect((await reader.read()).done).toBe(true);
    });

    it('tick이 못 도는 대조군은 하드 타임아웃에서 timeout 이벤트로 닫는다', async () => {
        const reader = createProbeStream({
            durationSeconds: 1,
            intervalSeconds: 100,
        }).getReader();
        await readText(reader);
        await readText(reader);

        vi.advanceTimersByTime(6000);

        expect(await readText(reader)).toBe(
            'event: timeout\ndata: {"seq":0,"elapsedMs":6000}\n\n'
        );
        expect((await reader.read()).done).toBe(true);
    });

    it('cancel하면 interval과 하드 타임아웃을 회수한다', async () => {
        const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        const reader = createProbeStream({
            durationSeconds: 30,
            intervalSeconds: 5,
        }).getReader();
        await readText(reader);

        await reader.cancel();

        expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
        expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('이미 닫힌 컨트롤러에 tick이 겹쳐도 던지지 않고 타이머를 회수한다', async () => {
        const enqueue = vi.spyOn(
            ReadableStreamDefaultController.prototype,
            'enqueue'
        );
        const reader = createProbeStream({
            durationSeconds: 30,
            intervalSeconds: 5,
        }).getReader();
        await readText(reader);
        await readText(reader);
        enqueue.mockImplementation(() => {
            throw new TypeError('stream already closed');
        });

        expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
        expect(vi.getTimerCount()).toBe(0);
    });
});
