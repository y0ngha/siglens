import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

import { GET } from '@/app/api/sse-probe/route';

const SECRET = 'probe-secret';
const decoder = new TextDecoder();

afterEach(() => {
    vi.unstubAllEnvs();
});

function call(headers?: HeadersInit, query = ''): Response {
    return GET(
        new Request(`https://siglens.io/api/sse-probe${query}`, { headers })
    );
}

async function readEvent(
    reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> {
    const { value, done } = await reader.read();
    if (done) return '';
    return decoder.decode(value);
}

describe('GET /api/sse-probe', () => {
    it('CRON_SECRET이 설정되지 않았으면 401', () => {
        vi.stubEnv('CRON_SECRET', '');
        expect(call().status).toBe(401);
    });

    it('Bearer 토큰이 틀리면 401', () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        expect(call({ authorization: 'Bearer nope' }).status).toBe(401);
    });

    /**
     * `next.config.ts`가 `compress: true`가 된 뒤로 이 지시어는 CloudFlare만이 아니라
     * **오리진 자신에게도** 걸린다 — Next의 압축 미들웨어가 `no-transform`을 보고
     * 빠진다. 지우면 이 진단 스트림이 gzip 버퍼에 갇혀 tick 간격 측정이 전부
     * 거짓이 된다(이 엔드포인트의 존재 이유가 정확한 타이밍 측정이다).
     *
     * 자매 라우트(`/api/analysis/stream`)의 같은 단언과 짝을 이룬다 — `next.config.ts`의
     * 안전성 근거가 두 라우트 모두를 지목하므로 한쪽만 고정하면 절반만 지켜진다.
     */
    it('SSE 헤더에 no-transform을 붙인다', async () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        const res = call({ authorization: `Bearer ${SECRET}` });

        expect(res.headers.get('Content-Type')).toContain('text/event-stream');
        expect(res.headers.get('Cache-Control')).toContain('no-transform');
        expect(res.headers.get('X-Accel-Buffering')).toBe('no');

        // 스트림을 취소해 interval/hard timeout 타이머를 회수한다.
        await res.body?.cancel();
    });

    describe('query parameter parsing (readPositiveInt)', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.stubEnv('CRON_SECRET', SECRET);
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('duration/interval이 없으면 기본값(150s/5s)을 open 이벤트에 싣는다', async () => {
            const res = call({ authorization: `Bearer ${SECRET}` });
            const reader = res.body!.getReader();
            await readEvent(reader); // retry line
            const open = await readEvent(reader);
            expect(open).toContain('event: open');
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
                intervalSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(150);
            expect(parsed.intervalSeconds).toBe(5);
            await reader.cancel();
        });

        it('숫자가 아닌 값(오타)은 기본값으로 폴백한다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=10abc&interval=xx'
            );
            const reader = res.body!.getReader();
            await readEvent(reader);
            const open = await readEvent(reader);
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
                intervalSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(150);
            expect(parsed.intervalSeconds).toBe(5);
            await reader.cancel();
        });

        it('0 이하의 값은 기본값으로 폴백한다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=0'
            );
            const reader = res.body!.getReader();
            await readEvent(reader);
            const open = await readEvent(reader);
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(150);
            await reader.cancel();
        });

        it('안전 정수 범위를 넘는 값은 기본값으로 폴백한다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=99999999999999999999'
            );
            const reader = res.body!.getReader();
            await readEvent(reader);
            const open = await readEvent(reader);
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(150);
            await reader.cancel();
        });

        it('상한(660)을 넘는 값은 660으로 clamp한다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=99999'
            );
            const reader = res.body!.getReader();
            await readEvent(reader);
            const open = await readEvent(reader);
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(660);
            await reader.cancel();
        });

        it('유효한 값은 그대로 반영된다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=30&interval=10'
            );
            const reader = res.body!.getReader();
            await readEvent(reader);
            const open = await readEvent(reader);
            const parsed = JSON.parse(open.split('data: ')[1]!) as {
                durationSeconds: number;
                intervalSeconds: number;
            };
            expect(parsed.durationSeconds).toBe(30);
            expect(parsed.intervalSeconds).toBe(10);
            await reader.cancel();
        });
    });

    describe('스트림 lifecycle', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.stubEnv('CRON_SECRET', SECRET);
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('interval마다 event: tick을 emit하고, duration 경과 후 event: done으로 스트림을 닫는다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=2&interval=1'
            );
            const reader = res.body!.getReader();
            await readEvent(reader); // retry
            await readEvent(reader); // open

            vi.advanceTimersByTime(1000);
            const tick1 = await readEvent(reader);
            expect(tick1).toContain('event: tick');
            expect(JSON.parse(tick1.split('data: ')[1]!)).toMatchObject({
                seq: 1,
            });

            vi.advanceTimersByTime(1000);
            const done = await readEvent(reader);
            expect(done).toContain('event: done');
            expect(JSON.parse(done.split('data: ')[1]!)).toMatchObject({
                seq: 2,
            });

            const end = await reader.read();
            expect(end.done).toBe(true);
        });

        it('interval > duration인 대조군은 tick 없이 hard timeout으로 event: timeout을 emit한다', async () => {
            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=1&interval=100'
            );
            const reader = res.body!.getReader();
            await readEvent(reader); // retry
            await readEvent(reader); // open

            // Hard timeout fires at duration*1000 + grace(5000) = 6000ms,
            // long before the 100s interval tick would ever fire.
            vi.advanceTimersByTime(6000);
            const timeout = await readEvent(reader);
            expect(timeout).toContain('event: timeout');

            const end = await reader.read();
            expect(end.done).toBe(true);
        });

        it('클라이언트가 cancel하면 interval/hard-timeout 타이머를 회수한다', async () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
            const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

            const res = call(
                { authorization: `Bearer ${SECRET}` },
                '?duration=30&interval=5'
            );
            const reader = res.body!.getReader();
            await readEvent(reader); // retry
            await readEvent(reader); // open

            const timerId = setIntervalSpy.mock.results[0]?.value;
            await reader.cancel();

            expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
            expect(clearTimeoutSpy).toHaveBeenCalled();

            // No further sends should be attempted once cancelled.
            expect(() => vi.advanceTimersByTime(60_000)).not.toThrow();
        });

        it('첫 전송(enqueue)이 실패하면 타이머를 걸지 않는다 (closed 조기 가드)', () => {
            const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
            vi.spyOn(
                ReadableStreamDefaultController.prototype,
                'enqueue'
            ).mockImplementation(() => {
                throw new TypeError('stream already closed');
            });

            call({ authorization: `Bearer ${SECRET}` }, '?duration=30');

            expect(setIntervalSpy).not.toHaveBeenCalled();
        });
    });
});
