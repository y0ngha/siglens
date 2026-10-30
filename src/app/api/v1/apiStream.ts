import { HEARTBEAT_INTERVAL_MS } from '@/shared/lib/sse/heartbeatStream';

/** heartbeat 한 번이 쓰는 바이트. JSON은 값 앞의 공백을 허용하므로 `JSON.parse`가 그대로 읽는다. */
const HEARTBEAT_BYTE = '\n';

/**
 * 스트리밍 JSON 응답의 헤더. SSE 라우트(`/api/analysis/stream`)의 `SSE_HEADERS`와 같은 이유로 `no-transform`을
 * 건다: `next.config.ts`가 `compress: true`라 압축 미들웨어가 응답을 gzip 스트림에 넣으면 heartbeat가
 * 버퍼링돼 침묵 구간이 그대로 프록시에 보인다(Cloudflare Proxy Read Timeout 125.9초 실측). `X-Accel-Buffering`은
 * nginx 계열 중간자의 응답 버퍼링을 끈다.
 */
export const STREAMING_JSON_HEADERS: Readonly<Record<string, string>> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
};

/** `streamingJsonResponse`의 입력. */
export interface StreamingJsonOptions {
    /** 최종 JSON 본문. reject되면 일반 오류 봉투로 닫는다. */
    body: Promise<unknown>;
    /** 응답 헤더에 더할 값(한도 헤더 등). `STREAMING_JSON_HEADERS`가 우선한다. */
    headers?: HeadersInit;
    /** 클라이언트가 끊으면 timer를 회수하고 스트림을 닫는다. */
    signal: AbortSignal;
    /** `body`가 reject될 때 쓰는 봉투(호출부가 오류 모양을 정한다). */
    onBodyError: () => unknown;
}

/**
 * 상태 200을 먼저 보내고 {@link HEARTBEAT_INTERVAL_MS}마다 공백 한 바이트를 흘리다가, `body`가 정해지면
 * 최종 JSON 한 덩어리를 쓰고 닫는다. 긴 침묵을 프록시가 끊지 않게 하려는 장치다(SSE 라우트와 같은 간격·근거).
 *
 * 상태 코드는 첫 바이트와 함께 확정되므로 이후의 실패는 200 본문의 `{ error }`로 나간다 — 클라이언트는 본문을
 * 파싱해 `error` 필드를 봐야 한다. 첫 바이트(공백)를 즉시 써 헤더가 바로 나가게 한다.
 *
 * timer 누수 방어는 `heartbeatStream`과 같다: 닫힌 뒤의 `enqueue`는 throw하므로 `closed` 플래그와 try/catch로
 * 첫 실패에서 timer를 회수한다.
 */
export function streamingJsonResponse({
    body,
    headers,
    signal,
    onBodyError,
}: StreamingJsonOptions): Response {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

    const finish = (): void => {
        closed = true;
        if (timer !== undefined) clearInterval(timer);
        timer = undefined;
    };
    const write = (text: string): void => {
        if (closed || controllerRef === undefined) return;
        try {
            controllerRef.enqueue(encoder.encode(text));
        } catch {
            finish();
        }
    };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controllerRef = controller;
            write(HEARTBEAT_BYTE);
            timer = setInterval(
                () => write(HEARTBEAT_BYTE),
                HEARTBEAT_INTERVAL_MS
            );
            const abort = (): void => {
                finish();
                try {
                    controller.close();
                } catch {
                    // 이미 취소돼 닫혔다.
                }
            };
            if (signal.aborted) {
                abort();
                return;
            }
            signal.addEventListener('abort', abort, { once: true });
            void body
                .catch(() => onBodyError())
                .then(final => {
                    if (closed) return;
                    write(JSON.stringify(final));
                    finish();
                    try {
                        controller.close();
                    } catch {
                        // 이미 취소돼 닫혔다.
                    }
                });
        },
        cancel() {
            finish();
        },
    });

    const merged = new Headers(headers);
    for (const [name, value] of Object.entries(STREAMING_JSON_HEADERS))
        merged.set(name, value);
    return new Response(stream, { status: 200, headers: merged });
}
