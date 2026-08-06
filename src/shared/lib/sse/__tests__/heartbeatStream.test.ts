import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { heartbeatStream, HEARTBEAT_INTERVAL_MS } from '../heartbeatStream';
import {
    __resetActiveStreamsForTests,
    __activeStreamCount,
} from '../activeStreams';

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

/**
 * Gap 8: HEARTBEAT_INTERVAL_MS 상한 고정 검증.
 *
 * 기존 타이머 기반 테스트는 모두 HEARTBEAT_INTERVAL_MS를 상수로 참조해 시간을
 * 진행하므로 어떤 값이든 녹색이 된다. 이 리터럴 단언 없이 90_000으로 올리면
 * 모든 타이머 테스트가 여전히 통과하지만, ALB idle_timeout 실측값(61.1초)이
 * heartbeat 두 번 사이 간격에서 연결을 끊어 버린다.
 *
 * 실측 근거 (v0.50.1, /api/sse-probe):
 *   - heartbeat 없음 → 61.1초에 HTTP/2 INTERNAL_ERROR (524 아님)
 *   - 25~30초 heartbeat → 286초 완주
 *   CF Proxy Read Timeout(125초)은 text/event-stream에서 발동하지 않음.
 */
it('ALB idle_timeout(60초)보다 짧아야 한다 — 실측: heartbeat 없으면 61.1초에 끊김', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBeLessThan(60_000);
});

describe('heartbeatStream', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        __resetActiveStreamsForTests();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        __resetActiveStreamsForTests();
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
        it('promise가 reject되면 event: error를 emit하고 스트림을 닫는다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            // 영문 내부 오류 — message masking으로 제네릭 한국어 메시지가 전달된다.
            reject(new Error('LLM timeout'));

            const { value, done } = await readString(reader);
            expect(done).toBe(false);
            expect(value).toContain('event: error');
            // 원래 메시지 대신 제네릭 한국어 메시지가 들어간다.
            expect(value).toContain('분석 중 오류가 발생했습니다');

            const end = await reader.read();
            expect(end.done).toBe(true);
        });

        it('Error가 아닌 값을 reject해도 message를 문자열(한국어)로 변환한다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            // 영문 문자열 — 마스킹되어 제네릭 한국어 메시지로 교체된다.
            reject('string error');

            const { value } = await readString(reader);
            expect(value).toContain('분석 중 오류가 발생했습니다');
        });

        it('reject 시 clearInterval을 호출해 타이머를 회수한다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

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

    describe('safely — enqueue가 throw할 때 타이머를 회수한다', () => {
        it('heartbeat 중 enqueue가 throw하면 safely catch가 타이머를 정리한다', async () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

            /**
             * 클라이언트 연결 끊김 시뮬레이션:
             * open 이벤트(1회째)만 실제 enqueue를 통과시키고, 이후 호출은 throw한다.
             * safely()가 catch하여 closed=true + clearTimer()를 호출해야 한다.
             *
             * ReadableStreamDefaultController.prototype.enqueue를 스파이하면
             * 실 스트림 내부 상태를 건드리지 않고도 throw 경로를 재현할 수 있다.
             */
            const realEnqueue =
                ReadableStreamDefaultController.prototype.enqueue;
            let enqueueCount = 0;
            vi.spyOn(
                ReadableStreamDefaultController.prototype,
                'enqueue'
            ).mockImplementation(function (
                this: ReadableStreamDefaultController<unknown>,
                chunk: unknown
            ) {
                enqueueCount++;
                if (enqueueCount === 1) {
                    // open 이벤트 — 실제 구현에 위임한다.
                    return realEnqueue.call(this, chunk);
                }
                // heartbeat 이벤트부터 throw — 연결 끊김 후 enqueue가 실패하는 상황.
                throw new TypeError(
                    'Cannot enqueue a chunk into a closed readable stream controller'
                );
            });

            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // open 소비 — timer가 이미 설정됐다.

            const timerId = setIntervalSpy.mock.results[0]?.value;

            // heartbeat 발화 → enqueue throw → safely catch → clearTimer() 호출.
            vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

            expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);

            // closed=true이므로 이후 타이머 발화에서 enqueue 재시도가 없어야 한다.
            const countBeforeExtraAdvance = enqueueCount;
            vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS * 3);
            expect(enqueueCount).toBe(countBeforeExtraAdvance);

            reader.releaseLock();
        });

        /**
         * Gap 9: 첫 번째 enqueue(open 이벤트)가 throw할 때의 조기 종료 가드.
         *
         * `start()` 흐름: send(open) → safely()가 throw를 catch → closed=true →
         * `if (closed) return;` → `setInterval`이 생성되지 않는다.
         * 이 가드가 없으면 타이머가 생성되어 닫힌 스트림에 무한히 enqueue를 시도한다.
         *
         * 분기 커버리지 60% → 이 케이스로 `if (closed) return` 분기를 커버한다.
         */
        it('첫 번째 enqueue(open 이벤트)가 throw하면 setInterval이 생성되지 않는다', () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

            // 첫 번째 enqueue 자체가 throw — 스트림이 start() 시점에 이미 닫힌 상황.
            vi.spyOn(
                ReadableStreamDefaultController.prototype,
                'enqueue'
            ).mockImplementation(function () {
                throw new TypeError(
                    'Cannot enqueue a chunk into a closed readable stream controller'
                );
            });

            // heartbeatStream 생성 — start()는 동기적으로 호출된다.
            heartbeatStream(new Promise<never>(() => {}));

            // safely()가 throw를 잡아 closed=true → if (closed) return이 발동해
            // setInterval이 호출되지 않아야 한다.
            expect(setIntervalSpy).not.toHaveBeenCalled();
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

    describe('Fix 1a — 거부 시 로깅 및 메시지 마스킹', () => {
        it('promise reject 시 [analysis-stream] failed: 접두로 console.error를 호출한다', async () => {
            const consoleErrorSpy = vi
                .spyOn(console, 'error')
                .mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            const err = new Error(
                'DEEPSEEK_API_KEY environment variable is required'
            );
            reject(err);
            await reader.read(); // error event

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[analysis-stream] failed:',
                err
            );
        });

        it('영문 내부 오류 메시지는 제네릭 한국어 메시지로 교체된다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            reject(
                new Error('DEEPSEEK_API_KEY environment variable is required')
            );

            const { value } = await readString(reader);
            expect(value).toContain('event: error');
            const parsed = JSON.parse(value!.split('data: ')[1]!) as {
                message: string;
            };
            expect(parsed.message).not.toContain('DEEPSEEK_API_KEY');
            expect(parsed.message).toMatch(/[가-힣]/); // 한국어 메시지로 교체됐는지 확인
        });

        it('AI_SERVER_UNSTABLE sentinel은 ASCII지만 마스킹하지 않는다', async () => {
            // 클라이언트(`useAnalysis`)가 이 sentinel을 자체 문구로 매핑한다 —
            // 마스킹해 버리면 그 분기가 죽는다.
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open
            reject(new Error('AI_SERVER_UNSTABLE'));

            const { value } = await readString(reader);
            const parsed = JSON.parse(value!.split('data: ')[1]!) as {
                message: string;
            };
            expect(parsed.message).toBe('AI_SERVER_UNSTABLE');
        });

        it('이미 현지화된 한국어 메시지는 그대로 전달된다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const koreanMsg = '분석 시간이 초과되었습니다. 다시 시도해 주세요.';
            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            reject(new Error(koreanMsg));

            const { value } = await readString(reader);
            const parsed = JSON.parse(value!.split('data: ')[1]!) as {
                message: string;
            };
            expect(parsed.message).toBe(koreanMsg);
        });

        it('BYOK 게이트 한국어 메시지도 그대로 전달된다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const gateMsg =
                '선택한 모델은 프리미엄 등급에서만 사용 가능합니다. API 키를 등록하거나 등급을 업그레이드해 주세요.';
            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open

            reject(new Error(gateMsg));

            const { value } = await readString(reader);
            const parsed = JSON.parse(value!.split('data: ')[1]!) as {
                message: string;
            };
            expect(parsed.message).toBe(gateMsg);
        });
    });

    describe('Fix 2 — in-flight drain 카운터', () => {
        it('open 이벤트 전송 후 activeStream 카운터가 1 증가한다', async () => {
            expect(__activeStreamCount()).toBe(0);
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // open

            expect(__activeStreamCount()).toBe(1);

            reader.releaseLock();
        });

        it('promise resolve 후 카운터가 감소한다', async () => {
            const { promise, resolve } = deferred<string>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open
            expect(__activeStreamCount()).toBe(1);

            resolve('done');
            await reader.read(); // done event
            await reader.read(); // stream closed

            expect(__activeStreamCount()).toBe(0);
        });

        it('promise reject 후 카운터가 감소한다', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});

            const { promise, reject } = deferred<never>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open
            expect(__activeStreamCount()).toBe(1);

            reject(new Error('fail'));
            await reader.read(); // error event
            await reader.read(); // stream closed

            expect(__activeStreamCount()).toBe(0);
        });

        it('cancel 시 카운터가 감소한다', async () => {
            const stream = heartbeatStream(new Promise<never>(() => {}));
            const reader = stream.getReader();

            await reader.read(); // open
            expect(__activeStreamCount()).toBe(1);

            await reader.cancel();
            expect(__activeStreamCount()).toBe(0);
        });

        it('cancel 후 promise가 resolve돼도 카운터가 두 번 감소하지 않는다', async () => {
            const { promise, resolve } = deferred<string>();
            const stream = heartbeatStream(promise);
            const reader = stream.getReader();

            await reader.read(); // open
            expect(__activeStreamCount()).toBe(1);

            await reader.cancel(); // cancel first
            expect(__activeStreamCount()).toBe(0);

            resolve('late'); // promise resolves after cancel
            await Promise.resolve(); // flush microtask

            // 0 미만으로 떨어지지 않아야 한다.
            expect(__activeStreamCount()).toBe(0);
        });
    });
});
