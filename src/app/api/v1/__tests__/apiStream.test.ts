import { streamingJsonResponse } from '@/app/api/v1/apiStream';
import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';

const decoder = new TextDecoder();

/** 응답 본문을 백그라운드에서 읽어 청크를 모은다 — 가짜 타이머를 진행시키며 중간 상태를 본다. */
function collect(response: Response) {
    const chunks: string[] = [];
    const reader = response.body!.getReader();
    let done = false;
    const finished = (async () => {
        for (;;) {
            const next = await reader.read();
            if (next.done) {
                done = true;
                return;
            }
            chunks.push(decoder.decode(next.value));
        }
    })();
    return {
        chunks,
        text: () => chunks.join(''),
        isDone: () => done,
        finished,
        cancel: () => reader.cancel(),
    };
}

function make(
    overrides: Partial<Parameters<typeof streamingJsonResponse>[0]> & {
        body: Promise<unknown>;
    }
) {
    return streamingJsonResponse({
        signal: new AbortController().signal,
        onBodyError: () => ({ error: { code: 'internal_error' } }),
        ...overrides,
    });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('streamingJsonResponse — 헤더', () => {
    it('200 + application/json + no-transform(압축·버퍼링 방지) + X-Accel-Buffering: no', () => {
        const response = make({
            body: new Promise(() => undefined),
            headers: { 'X-RateLimit-Limit': '60' },
        });
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe(
            'application/json; charset=utf-8'
        );
        expect(response.headers.get('Cache-Control')).toBe(
            'no-store, no-transform'
        );
        expect(response.headers.get('X-Accel-Buffering')).toBe('no');
        // 호출부가 준 한도 헤더는 그대로 남는다.
        expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    });

    it('호출부 헤더가 스트리밍 필수 헤더를 덮지 못한다', () => {
        const response = make({
            body: new Promise(() => undefined),
            headers: { 'Cache-Control': 'public, max-age=60' },
        });
        expect(response.headers.get('Cache-Control')).toBe(
            'no-store, no-transform'
        );
    });
});

describe('streamingJsonResponse — heartbeat와 최종 본문', () => {
    it('첫 공백은 즉시 나가고, 이후 HEARTBEAT_INTERVAL_MS마다 공백 한 바이트가 본문보다 먼저 나온다', async () => {
        let resolveBody: (value: unknown) => void = () => undefined;
        const body = new Promise(resolve => (resolveBody = resolve));
        const out = collect(make({ body }));

        await vi.advanceTimersByTimeAsync(0);
        expect(out.chunks).toEqual(['\n']);

        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS - 1);
        expect(out.chunks).toEqual(['\n']);
        await vi.advanceTimersByTimeAsync(1);
        expect(out.chunks).toEqual(['\n', '\n']);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 2);
        expect(out.chunks).toEqual(['\n', '\n', '\n', '\n']);
        expect(out.isDone()).toBe(false);

        resolveBody({ data: { ok: 1 }, meta: { tool: 'run_fresh_analysis' } });
        await out.finished;

        expect(out.chunks.slice(0, 4)).toEqual(['\n', '\n', '\n', '\n']);
        expect(out.chunks).toHaveLength(5);
        // 앞의 공백을 그대로 둔 채 통째로 JSON.parse된다.
        expect(JSON.parse(out.text())).toEqual({
            data: { ok: 1 },
            meta: { tool: 'run_fresh_analysis' },
        });
        expect(out.text().startsWith('\n\n\n\n{')).toBe(true);
    });

    it('끝나면 timer를 남기지 않는다', async () => {
        const out = collect(make({ body: Promise.resolve({ done: true }) }));
        await out.finished;
        expect(vi.getTimerCount()).toBe(0);
    });

    it('본문이 먼저 끝나면 heartbeat 없이 공백 한 바이트 + JSON', async () => {
        const out = collect(make({ body: Promise.resolve({ a: 1 }) }));
        await out.finished;
        expect(out.text()).toBe('\n{"a":1}');
    });
});

describe('streamingJsonResponse — 시작 뒤의 실패', () => {
    it('상태는 200 그대로이고 최종 본문이 { error } 봉투다', async () => {
        const failure = {
            error: { code: 'provider_error', message: 'rejected' },
        };
        const out = collect(make({ body: Promise.resolve(failure) }));
        await out.finished;
        expect(JSON.parse(out.text())).toEqual(failure);
    });

    it('본문 promise가 reject되면 호출부가 정한 오류 봉투로 닫는다', async () => {
        const out = collect(
            make({
                body: Promise.reject(new Error('boom: secret detail')),
                onBodyError: () => ({
                    error: { code: 'internal_error', message: 'Unexpected.' },
                }),
            })
        );
        await out.finished;
        const parsed = JSON.parse(out.text());
        expect(parsed).toEqual({
            error: { code: 'internal_error', message: 'Unexpected.' },
        });
        expect(out.text()).not.toContain('secret');
    });
});

describe('streamingJsonResponse — 취소', () => {
    it('클라이언트 signal이 abort되면 스트림을 닫고 timer를 회수한다', async () => {
        const controller = new AbortController();
        let resolveBody: (value: unknown) => void = () => undefined;
        const out = collect(
            make({
                body: new Promise(resolve => (resolveBody = resolve)),
                signal: controller.signal,
            })
        );
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
        expect(out.chunks).toHaveLength(2);

        controller.abort();
        await out.finished;
        expect(out.isDone()).toBe(true);
        expect(vi.getTimerCount()).toBe(0);

        // 닫힌 뒤에 본문이 정해져도 아무것도 쓰지 않고 throw하지 않는다.
        resolveBody({ late: true });
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
        expect(out.text()).not.toContain('late');
        expect(out.chunks).toHaveLength(2);
    });

    it('독자가 cancel하면 timer를 회수하고 이후 heartbeat를 쓰지 않는다', async () => {
        const out = collect(make({ body: new Promise(() => undefined) }));
        await vi.advanceTimersByTimeAsync(0);
        await out.cancel();
        expect(vi.getTimerCount()).toBe(0);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
        expect(out.chunks).toEqual(['\n']);
    });

    it('이미 abort된 signal로 시작해도 던지지 않는다', async () => {
        const controller = new AbortController();
        controller.abort();
        const out = collect(
            make({
                body: Promise.resolve({ a: 1 }),
                signal: controller.signal,
            })
        );
        await out.finished;
        expect(out.text()).toBe('\n');
        expect(vi.getTimerCount()).toBe(0);
    });
});
