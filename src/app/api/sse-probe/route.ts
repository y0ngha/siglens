import { constants } from 'node:http2';
import {
    createProbeStream,
    DEFAULT_DURATION_SECONDS,
    DEFAULT_INTERVAL_SECONDS,
    MAX_DURATION_SECONDS,
} from '@/app/api/sse-probe/_lib/probeStream';
import { readPositiveInt } from '@/app/api/sse-probe/_lib/readPositiveInt';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';

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

/** 진단 SSE 스트림을 연다. Bearer 인증이 없으면 401이고, 쿼리의 `duration`·`interval`은 상한이 걸린다. */
export function GET(request: Request): Response {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    const params = new URL(request.url).searchParams;
    const stream = createProbeStream({
        durationSeconds: readPositiveInt(
            params,
            'duration',
            DEFAULT_DURATION_SECONDS,
            MAX_DURATION_SECONDS
        ),
        // interval에도 같은 상한을 건다. 상한이 없으면 거대한 값 하나로 tick이 영원히
        // 돌지 않는 연결을 만들 수 있다(하드 타임아웃이 있더라도 굳이 허용할 이유가 없다).
        intervalSeconds: readPositiveInt(
            params,
            'interval',
            DEFAULT_INTERVAL_SECONDS,
            MAX_DURATION_SECONDS
        ),
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
