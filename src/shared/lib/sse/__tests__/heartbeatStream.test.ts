import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { heartbeatStream, HEARTBEAT_INTERVAL_MS } from '../heartbeatStream';

const decoder = new TextDecoder();

/** Deferred promise — lets tests control when the work promise resolves/rejects. */
function deferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason: unknown) => void;
} {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

/** Read a single chunk from the reader and decode to string. */
async function readString(
    reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<{ value: string; done: false } | { value: undefined; done: true }> {
    const result = await reader.read();
    if (result.done) return { value: undefined, done: true };
    return { value: decoder.decode(result.value), done: false };
}

describe('heartbeatStream', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    describe('open 이벤트', () => {
        it('스트림 생성 즉시 event: open을 첫 청크로 emit한다', async () => {
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            const { value, done } = await readString(reader);
            expect(done).toBe(false);
            expect(value).toContain('event: open');

            reader.releaseLock();
        });
    });

    describe('heartbeat 이벤트', () => {
        it(`${HEARTBEAT_INTERVAL_MS}ms 후 event: heartbeat를 emit한다`, async () => {
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // consume open

            vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

            const { value, done } = await readString(reader);
            expect(done).toBe(false);
            expect(value).toContain('event: heartbeat');

            reader.releaseLock();
        });

        it('interval마다 반복적으로 heartbeat를 emit한다', async () => {
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // consume open

            for (let i = 0; i < 3; i++) {
                vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
                const { value } = await readString(reader);
                expect(value).toContain('event: heartbeat');
            }

            reader.releaseLock();
        });
    });

    describe('done 이벤트 — promise resolve', () => {
        it('promise가 resolve되면 event: done을 result와 함께 emit한다', async () => {
            const { promise, resolve } = deferred<{ symbol: string }>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            resolve({ symbol: 'AAPL' });

            const { value, done } = await readString(reader);
            expect(done).toBe(false);
            expect(value).toContain('event: done');
            expect(value).toContain('AAPL');
            const parsed = JSON.parse(value!.split('data: ')[1]!);
            expect(parsed.result).toEqual({ symbol: 'AAPL' });
        });

        it('done 이벤트 후 스트림이 닫힌다', async () => {
            const { promise, resolve } = deferred<string>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            resolve('payload');
            await reader.read(); // done

            const end = await reader.read();
            expect(end.done).toBe(true);
        });

        it('resolve 시 clearInterval을 호출해 타이머를 회수한다', async () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            const { promise, resolve } = deferred<string>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open — timer was set up by now

            const timerId = setIntervalSpy.mock.results[0]?.value;

            resolve('done');
            await reader.read(); // done event

            // The timer must be cleared before the interval can fire again.
            expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
        });
    });

    describe('error 이벤트 — promise reject', () => {
        it('promise가 reject되면 event: error를 message와 함께 emit하고 스트림을 닫는다', async () => {
            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            reject(new Error('LLM timeout'));

            const { value, done } = await readString(reader);
            expect(done).toBe(false);
            expect(value).toContain('event: error');
            expect(value).toContain('LLM timeout');

            const end = await reader.read();
            expect(end.done).toBe(true);
        });

        it('Error가 아닌 값을 reject해도 message를 문자열로 변환한다', async () => {
            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            reject('string error');

            const { value } = await readString(reader);
            expect(value).toContain('string error');
        });

        it('reject 시 clearInterval을 호출해 타이머를 회수한다', async () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            const timerId = setIntervalSpy.mock.results[0]?.value;

            reject(new Error('fail'));
            await reader.read(); // error event

            expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
        });
    });

    describe('cancel — 클라이언트 연결 끊김', () => {
        it('cancel 시 clearInterval을 호출해 타이머를 즉시 회수한다', async () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // open — timer is running

            const timerId = setIntervalSpy.mock.results[0]?.value;

            await reader.cancel();

            // cancel() must clear the interval before safely() could serve as fallback.
            expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
        });

        it('cancel 후 타이머를 진행해도 uncaught 에러가 발생하지 않는다', async () => {
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // open

            await reader.cancel();

            // If clearInterval was NOT called, the timer would fire and try to enqueue
            // into a cancelled stream. The safely() guard prevents re-throw, but the
            // proper defense is clearInterval in cancel(). Either way no uncaught throw.
            expect(() =>
                vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3)
            ).not.toThrow();
        });
    });
});
