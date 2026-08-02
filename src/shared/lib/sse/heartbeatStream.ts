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
 */
export function heartbeatStream<T>(
    work: Promise<T>
): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;

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
            if (closed) return;

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
                },
                (err: unknown) => {
                    clearTimer();
                    const message =
                        err instanceof Error ? err.message : String(err);
                    send(
                        `event: error\ndata: ${JSON.stringify({ message })}\n\n`
                    );
                    safely(() => {
                        controller.close();
                        closed = true;
                    });
                }
            );
        },

        cancel() {
            // Client disconnected or the response was aborted. Reclaim the timer
            // immediately so it does not keep firing into a dead stream.
            if (timer !== undefined) clearInterval(timer);
        },
    });
}
