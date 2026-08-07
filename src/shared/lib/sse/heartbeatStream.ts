import {
    incrementActiveStreams,
    decrementActiveStreams,
} from './activeStreams';

/**
 * ALB `idle_timeout`이 60초다(실측: heartbeat 없이 61.1초에 끊김). 그 절반 이하로 잡아
 * heartbeat 한 번이 유실돼도 연결이 살아남게 한다. CF Proxy Read Timeout 125초는 이
 * 간격에서 아예 관여하지 않는다.
 */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * Wraps a promise as a Server-Sent Events `ReadableStream`.
 *
 * Events emitted:
 * - `open`:      Fired immediately. Delayed first byte = provably edge buffering, not slow server.
 * - `heartbeat`: Fired every {@link HEARTBEAT_INTERVAL_MS} while the promise is in-flight.
 *                Prevents the ALB idle-timeout (60 s, measured) from cutting the connection.
 * - `done`:      Fired with `{ result }` when the promise resolves. Stream closes after.
 * - `error`:     Fired with `{ message }` when the promise rejects. Stream closes after.
 *
 * ## Timer-leak defense (mirrors the production-verified `sse-probe` pattern)
 *
 * A `setInterval` callback that calls `controller.enqueue()` after the stream
 * has been closed or cancelled will THROW. Without a guard, that throw exits the
 * callback before `clearInterval` is reached, so the timer re-fires forever.
 *
 * Defense: a `closed` flag plus a try/catch inside every `enqueue` path (`safely`).
 * The first throw flips `closed` to `true` and reclaims the timer; subsequent
 * callbacks see `closed` and no-op immediately.
 *
 * Every exit path reclaims the timer:
 * - Normal resolution / rejection: `clearTimer()` is called before the final send.
 * - Client disconnect: the `ReadableStream.cancel()` callback calls `clearInterval`.
 *
 * ## 실패 로깅 (Fix 1a)
 *
 * promise가 reject되면 `[analysis-stream] failed:` 접두로 `console.error`를 남긴다.
 * 이 접두는 `infra/aws/07-alarms.sh`의 CloudWatch 메트릭 필터가 의존하는 안정 ASCII
 * 마커다 — non-ASCII로 변경하지 말 것(13-seo-prewarm.sh §FIX F 참조).
 *
 * 사용자에게는 한글이 포함된 메시지(이미 현지화된 메시지)는 그대로 전달하고,
 * 영문 내부 오류(예: `DEEPSEEK_API_KEY environment variable is required`)는 제네릭
 * 한국어 메시지로 교체해 환경변수·내부 스택 정보가 브라우저에 노출되지 않도록 한다.
 *
 * ## In-flight drain 카운터 (Fix 2)
 *
 * 첫 번째 send(open)가 성공하면 `incrementActiveStreams()`를 호출해 drain 카운터에 등록한다.
 * 모든 종료 경로(resolve, reject, cancel)에서 정확히 한 번 `decrementActiveStreams()`를 호출해
 * 감소시킨다. 이중 감소는 `decrement()` 내의 `decremented` 플래그로 방지한다.
 *
 * SIGTERM 핸들러(`instrumentation.node.ts`)가 `waitForActiveStreams`를 통해 이 카운터가
 * 0에 도달할 때까지 대기하므로, 배포 롤링 중 진행 중인 분석이 완주할 기회를 얻는다.
 */
export function heartbeatStream<T>(
    work: Promise<T>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;

    /**
     * start()와 cancel() 양쪽에서 `decrementActiveStreams`를 호출할 수 있으므로
     * 이중 감소를 방지하는 idempotent 래퍼.
     *
     * `streamRegistered`가 false(첫 send가 실패해 increment가 호출되지 않은 경우)이면
     * decrement도 호출하지 않는다 — cancel()이 그 경우에도 안전하게 호출될 수 있도록.
     */
    let streamRegistered = false;
    let decremented = false;
    const decrement = (): void => {
        if (!streamRegistered || decremented) return;
        decremented = true;
        decrementActiveStreams();
    };

    return new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;

            /** Reclaim the heartbeat timer. Idempotent — safe to call from any exit path. */
            const clearTimer = (): void => {
                if (timer !== undefined) clearInterval(timer);
            };

            /**
             * Wraps every `controller.enqueue` / `controller.close` call.
             *
             * If the stream has already been cancelled (client disconnect), enqueue throws.
             * Without this wrapper the throw escapes the callback before `clearInterval`,
             * leaving the timer to fire indefinitely.
             */
            const safely = (action: () => void): void => {
                if (closed) return;
                try {
                    action();
                } catch {
                    closed = true;
                    clearTimer();
                }
            };

            const send = (payload: string): void =>
                safely(() => controller.enqueue(encoder.encode(payload)));

            // First byte is sent immediately so the caller can distinguish
            // "slow server" from "edge buffering delayed the first chunk".
            send(`event: open\ndata: {}\n\n`);
            // If the initial send already failed (stream died before start completed)
            // there is no point in setting up the timer or attaching the promise handler.
            // 스트림이 첫 전송부터 죽었으면 drain 카운터에 등록하지 않는다.
            if (closed) {
                // work의 거부를 반드시 소비한다 — 아래 `work.then(...)`을 붙이지 못하고
                // 빠져나가므로, 잡아 주지 않으면 unhandled rejection이 된다.
                // (LLM 실패는 흔하고, 첫 바이트 전 클라이언트 이탈도 실제로 발생한다.)
                void work.catch(() => {});
                return;
            }

            // 스트림이 살아있음을 확인 — drain 카운터에 등록한다.
            incrementActiveStreams();
            streamRegistered = true;

            timer = setInterval(() => {
                send(`event: heartbeat\ndata: {}\n\n`);
            }, HEARTBEAT_INTERVAL_MS);

            work.then(
                result => {
                    clearTimer();
                    send(
                        `event: done\ndata: ${JSON.stringify({ result })}\n\n`
                    );
                    safely(() => {
                        controller.close();
                        closed = true;
                    });
                    // 정상 종료 — cancel이 먼저 발화한 경우 no-op(idempotent).
                    decrement();
                },
                (err: unknown) => {
                    clearTimer();
                    // [analysis-stream] failed: 접두는 07-alarms.sh CloudWatch 메트릭
                    // 필터와 정합하는 안정 ASCII 마커다 — non-ASCII 변경 금지.
                    console.error('[analysis-stream] failed:', err);
                    const rawMessage =
                        err instanceof Error ? err.message : String(err);
                    // 한글이 포함된 메시지는 이미 현지화된 사용자 메시지 — 그대로 전달한다
                    // (예: '분석 시간이 초과되었습니다. 다시 시도해 주세요.', BYOK 게이트 메시지).
                    // 영문 내부 오류는 제네릭 한국어 메시지로 교체해 환경변수·내부 스택
                    // 정보가 브라우저에 노출되지 않도록 한다.
                    // core의 재시도 소진 sentinel은 ASCII지만 클라이언트가 자체 문구로
                    // 매핑하므로 그대로 통과시킨다(`useAnalysis`의 catch 참조).
                    const isLocalized =
                        /[가-힣]/.test(rawMessage) ||
                        rawMessage === 'AI_SERVER_UNSTABLE';
                    const message = isLocalized
                        ? rawMessage
                        : '분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
                    send(
                        `event: error\ndata: ${JSON.stringify({ message })}\n\n`
                    );
                    safely(() => {
                        controller.close();
                        closed = true;
                    });
                    // 에러 종료 — cancel이 먼저 발화한 경우 no-op(idempotent).
                    decrement();
                }
            );
        },

        cancel() {
            // Client disconnected or the response was aborted. Reclaim the timer
            // immediately so it does not keep firing into a dead stream.
            if (timer !== undefined) clearInterval(timer);
            // 클라이언트 연결 해제 — 카운터를 감소한다.
            // work promise가 아직 in-flight이면 나중에 resolve/reject 경로도
            // decrement()를 호출하지만 decremented 플래그로 중복을 막는다.
            decrement();
        },
    });
}
