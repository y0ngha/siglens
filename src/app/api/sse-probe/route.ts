import { constants } from 'node:http2';
import { safeBearerCompare } from '@/shared/lib/auth/safeBearerCompare';
import { MS_PER_SECOND } from '@/shared/config/time';

const { HTTP_STATUS_UNAUTHORIZED } = constants;

/**
 * SSE 스트리밍이 Cloudflare 엣지를 그대로 통과하는지 실측하기 위한 진단
 * 엔드포인트. worker 제거 설계에서 "브라우저 요청 안에서 LLM 완료까지 대기"가
 * 가능한지가 이 한 가지 사실에 달려 있다:
 *
 * - CF Proxy Read Timeout은 125초이며 Enterprise가 아니면 변경할 수 없다.
 *   단 이 타임아웃은 "origin으로부터 아무것도 오지 않는 구간"에 걸리므로,
 *   주기적으로 바이트를 흘려보내면 그 이상 연결을 유지할 수 있다 — 이론상.
 * - 그러나 CF가 `text/event-stream`을 버퍼링해 flush하지 않는 사례가 보고돼
 *   있다. 버퍼링되면 heartbeat가 엣지에 갇혀 우회가 무효가 된다.
 *
 * 그래서 측정하는 것은 두 가지다: (1) 125초를 넘겨 완주하는가, (2) 각 이벤트가
 * 서버가 보낸 간격 그대로 도착하는가(= 버퍼링되지 않는가). 각 이벤트에 서버
 * 기준 경과 시간을 실어 보내므로, 수신 측 도착 시각과 대조하면 엣지에서 얼마나
 * 지연·병합됐는지 바로 드러난다.
 *
 * `interval > duration`으로 호출하면 그 구간 동안 서버가 의도적으로 침묵하는
 * 대조군이 된다 — heartbeat 없이 실제로 몇 초에 잘리는지를 실증하는 용도이며,
 * 이 대조 없이는 완주가 heartbeat 덕분인지 원래 안 잘리는지 구분할 수 없다.
 * 이 케이스에서도 연결이 방치되지 않도록 하드 타임아웃이 별도로 스트림을 닫는다.
 *
 * 프로덕션에 남아도 안전하도록 cron 라우트와 동일한 Bearer 인증을 요구한다.
 */
export const dynamic = 'force-dynamic';

/**
 * 스트림 길이 상한.
 *
 * 300초였던 것을 660초로 올린다 — `STREAM_DEADLINE_MS`를 10분으로 늘려도 되는지
 * 판단하려면 그 길이의 연결이 실제로 CF·ALB를 통과하는지 재야 하는데, 상한이 300초면
 * 잴 수가 없다. 기존 실측은 286초까지만 있었다(`docs/architecture/DEPLOY_RUNBOOK.md`
 * 및 SSE 실측 기록 참조). 660은 600초 측정에 여유 60초를 더한 값이다.
 *
 * 연결을 방치하지 않는다는 성질은 그대로다: `HARD_TIMEOUT_GRACE_MS`를 더한 하드
 * 타임아웃이 항상 스트림을 닫고, 라우트 전체가 cron과 동일한 Bearer 인증 뒤에 있다.
 */
const MAX_DURATION_SECONDS = 660;
const DEFAULT_DURATION_SECONDS = 150;
const DEFAULT_INTERVAL_SECONDS = 5;

/**
 * 하드 타임아웃 여유분. `interval > duration`인 대조군에서는 tick이 한 번도
 * 돌지 않아 정상 종료 경로에 도달하지 못하므로, duration 경과 후 이 여유를 두고
 * 강제로 닫는다. tick 기반 종료가 정상 동작할 때는 항상 그쪽이 먼저 이긴다.
 */
const HARD_TIMEOUT_GRACE_MS = 5 * MS_PER_SECOND;

/** SSE 클라이언트 재접속 힌트(ms). 진단용이라 재접속을 서두르게 할 이유가 없다. */
const SSE_RETRY_MS = 10_000;

/**
 * 쿼리 파라미터를 엄격하게 파싱한다. `Number.parseInt`는 `'10abc'`를 10으로
 * 받아주지만, 이 엔드포인트의 목적이 정밀한 타이밍 측정이라 오타가 조용히
 * 통과하면 측정값을 신뢰할 수 없게 된다 — 숫자만으로 이루어진 입력만 받는다.
 */
function readPositiveInt(
    params: URLSearchParams,
    key: string,
    fallback: number,
    max: number
): number {
    const raw = params.get(key);
    if (raw === null || !/^\d+$/.test(raw)) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

export function GET(request: Request): Response {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }
    if (!safeBearerCompare(request.headers.get('authorization'), expected)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    const params = new URL(request.url).searchParams;
    const durationSeconds = readPositiveInt(
        params,
        'duration',
        DEFAULT_DURATION_SECONDS,
        MAX_DURATION_SECONDS
    );
    // interval에도 같은 상한을 건다. 상한이 없으면 거대한 값 하나로 tick이 영원히
    // 돌지 않는 연결을 만들 수 있다(하드 타임아웃이 있더라도 굳이 허용할 이유가 없다).
    const intervalSeconds = readPositiveInt(
        params,
        'interval',
        DEFAULT_INTERVAL_SECONDS,
        MAX_DURATION_SECONDS
    );

    const startedAt = Date.now();
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let hardTimeout: ReturnType<typeof setTimeout> | undefined;

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;

            /** 타이머를 남김없이 회수한다. 어느 종료 경로에서 불려도 안전(멱등). */
            const clearTimers = (): void => {
                if (timer !== undefined) clearInterval(timer);
                if (hardTimeout !== undefined) clearTimeout(hardTimeout);
            };

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
            if (timer !== undefined) clearInterval(timer);
            if (hardTimeout !== undefined) clearTimeout(hardTimeout);
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            // no-transform은 CF가 응답을 변형/버퍼링하지 않도록 요청하는 표준 신호다.
            'Cache-Control': 'no-cache, no-store, no-transform',
            // nginx 계열 리버스 프록시의 응답 버퍼링을 끄는 관용 헤더.
            'X-Accel-Buffering': 'no',
            Connection: 'keep-alive',
        },
    });
}
