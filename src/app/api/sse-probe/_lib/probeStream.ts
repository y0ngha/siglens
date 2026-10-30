import { MS_PER_SECOND } from '@/shared/config/time';

/**
 * 스트림 길이 상한(초).
 *
 * `STREAM_DEADLINE_MS`를 10분으로 늘려도 되는지 판단하려면 그 길이의 연결이 실제로
 * Cloudflare 엣지(cloudflared 터널)를 통과하는지 재야 하는데, 상한이 300초면 잴 수가 없다.
 * 660은 600초 측정에 여유 60초를 더한 값이다.
 *
 * 연결을 방치하지 않는다는 성질은 그대로다: `HARD_TIMEOUT_GRACE_MS`를 더한 하드 타임아웃이
 * 항상 스트림을 닫고, 라우트 전체가 cron과 동일한 Bearer 인증 뒤에 있다.
 */
export const MAX_DURATION_SECONDS = 660;
export const DEFAULT_DURATION_SECONDS = 150;
export const DEFAULT_INTERVAL_SECONDS = 5;

/**
 * 하드 타임아웃 여유분. `interval > duration`인 대조군에서는 tick이 한 번도
 * 돌지 않아 정상 종료 경로에 도달하지 못하므로, duration 경과 후 이 여유를 두고
 * 강제로 닫는다. tick 기반 종료가 정상 동작할 때는 항상 그쪽이 먼저 이긴다.
 */
const HARD_TIMEOUT_GRACE_MS = 5 * MS_PER_SECOND;

/** SSE 클라이언트 재접속 힌트(ms). 진단용이라 재접속을 서두르게 할 이유가 없다. */
const SSE_RETRY_MS = 10_000;

/** `createProbeStream` 입력. 두 값 모두 `readPositiveInt`로 상한이 걸린 초 단위 정수다. */
export interface ProbeStreamOptions {
    durationSeconds: number;
    intervalSeconds: number;
}

/**
 * `/api/sse-probe`의 SSE 본문 스트림. 시작 즉시 `retry`·`open`을 보내고, `intervalSeconds`마다
 * `tick`을 흘려 보내다가 `durationSeconds`가 지나면 `done`으로, tick이 못 도는 대조군은
 * 하드 타임아웃의 `timeout`으로 닫는다. 각 이벤트에 서버 기준 경과 시간을 실어 수신 측 도착
 * 시각과 대조할 수 있게 한다.
 *
 * 타이머는 이 스트림이 소유한다 — 정상 종료, enqueue 실패, 클라이언트 cancel 어느 경로에서도
 * 남김없이 회수된다.
 */
export function createProbeStream({
    durationSeconds,
    intervalSeconds,
}: ProbeStreamOptions): ReadableStream<Uint8Array> {
    const startedAt = Date.now();
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let hardTimeout: ReturnType<typeof setTimeout> | undefined;

    /** 타이머를 남김없이 회수한다. 어느 종료 경로에서 불려도 안전(멱등). */
    const clearTimers = (): void => {
        if (timer !== undefined) clearInterval(timer);
        if (hardTimeout !== undefined) clearTimeout(hardTimeout);
    };

    return new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;

            /**
             * enqueue/close는 컨트롤러가 이미 닫힌 뒤 호출되면 던진다. 클라이언트가
             * 끊거나 엣지가 연결을 자른 직후(= 이 엔드포인트가 측정하려는 바로 그
             * 상황) tick이 한 번 더 도는 경합이 실재하므로, 던지면 조용히 흡수하고
             * 타이머부터 회수한다. 이 방어가 없으면 throw가 clearInterval 도달 전에
             * 콜백을 빠져나가 타이머가 영원히 재발화한다.
             */
            const safely = (action: () => void): void => {
                if (closed) return;
                try {
                    action();
                } catch {
                    closed = true;
                    clearTimers();
                }
            };

            const send = (payload: string): void => {
                safely(() => controller.enqueue(encoder.encode(payload)));
            };

            const finish = (event: string, seq: number): void => {
                const elapsedMs = Date.now() - startedAt;
                send(
                    `event: ${event}\ndata: ${JSON.stringify({ seq, elapsedMs })}\n\n`
                );
                clearTimers();
                safely(() => {
                    controller.close();
                    closed = true;
                });
            };

            // 첫 바이트를 즉시 보낸다. TTFB가 지연되면 그건 엣지 버퍼링이지
            // 서버가 늦은 게 아니라는 걸 수신 측이 구분할 수 있어야 한다.
            send(`retry: ${SSE_RETRY_MS}\n\n`);
            send(
                `event: open\ndata: ${JSON.stringify({
                    durationSeconds,
                    intervalSeconds,
                })}\n\n`
            );

            // 초기 send가 이미 실패했다면(= 스트림이 시작도 전에 죽었다면) 타이머를
            // 걸지 않는다. `safely`가 매 tick을 no-op으로 흘려보내 실질 피해는 없지만,
            // 죽은 연결을 위해 최대 305초짜리 타이머를 예약해 둘 이유가 없다.
            if (closed) return;

            let seq = 0;
            timer = setInterval(() => {
                const elapsedMs = Date.now() - startedAt;
                seq += 1;

                if (elapsedMs >= durationSeconds * MS_PER_SECOND) {
                    finish('done', seq);
                    return;
                }

                send(
                    `event: tick\ndata: ${JSON.stringify({ seq, elapsedMs })}\n\n`
                );
            }, intervalSeconds * MS_PER_SECOND);

            hardTimeout = setTimeout(
                () => finish('timeout', seq),
                durationSeconds * MS_PER_SECOND + HARD_TIMEOUT_GRACE_MS
            );
        },
        cancel() {
            // 클라이언트가 끊거나 엣지가 연결을 잘랐을 때 타이머를 반드시 회수한다.
            clearTimers();
        },
    });
}
