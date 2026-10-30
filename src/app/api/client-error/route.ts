/**
 * 클라이언트 예외 수집 엔드포인트. 하는 일은 로그 한 줄 남기고 204를 돌려주는 것뿐이다 —
 * 기준선 관찰은 Logs Insights(`[client-error]` 필터)로 한다.
 *
 * DB도 Redis도 타지 않는다. 사고 중에 이 경로가 실패하면 사고 자체가 안 보인다.
 * 그래서 IP별 한도도 인스턴스 메모리로 센다(아래 `reportLimiter`).
 */
import { constants } from 'node:http2';
import { resolveLimiterKey } from '@/app/api/_shared/limiterKey';
import { escapeForLog } from '@/app/api/client-error/_lib/escapeForLog';
import { readCappedBody } from '@/app/api/client-error/_lib/readCappedBody';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { createFixedWindowLimiter } from '@/shared/lib/fixedWindowLimiter';

const { HTTP_STATUS_NO_CONTENT } = constants;

/**
 * IP당 분당 기록 상한(인스턴스별). 정상 브라우저는 한 페이지 오류에 한두 건을 보낸다 —
 * 오류 경계가 연쇄로 터져도 이 근처에 오지 않는다. 넘는 건 스크립트가 CloudWatch Logs
 * 수집 비용을 태우는 것이다. 넘친 요청도 204로 답한다 —
 * 거절을 알려 줄 이유가 없고, 클라이언트 비콘은 응답을 보지 않는다.
 */
const REPORTS_PER_IP_PER_WINDOW = 30;
const REPORT_WINDOW_MS = MS_PER_MINUTE;
/** 추적할 IP 수 상한. IP를 돌려 가며 보내면 오래된 항목부터 밀려나는데, 그건 감수한다. */
const MAX_TRACKED_IPS = 10_000;

/**
 * IP별 기록 한도. Redis가 아니라 메모리인 이유는 파일 상단 — 이 경로는 외부 의존 없이 살아
 * 있어야 한다. 인스턴스마다 따로 세므로 실효 상한은 인스턴스 수만큼 늘지만, 목적이 무한 루프
 * 차단이라 충분하다.
 */
const reportLimiter = createFixedWindowLimiter({
    limit: REPORTS_PER_IP_PER_WINDOW,
    windowMs: REPORT_WINDOW_MS,
    maxTrackedKeys: MAX_TRACKED_IPS,
});

export const dynamic = 'force-dynamic';

/** `reportClientError`가 스택을 1200자로 자르므로 정상 페이로드는 이 한참 아래다. */
const MAX_BODY_BYTES = 4096;

/** 브라우저 오류 비콘 수신 — 한도·크기 검사를 통과한 본문만 로그에 남기고 언제나 204로 답한다. */
export async function POST(request: Request): Promise<Response> {
    // 한도 초과면 본문을 읽지도 않는다 — 읽는 것 자체가 이 남용의 비용이다.
    if (!reportLimiter.admit(await resolveLimiterKey(), Date.now())) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }

    // 정직한 클라이언트는 여기서 걸러진다(스트림을 열지도 않는다).
    const declared = Number(request.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
    }

    const raw = await readCappedBody(request, MAX_BODY_BYTES);
    if (raw === null || raw === '')
        return new Response(null, { status: HTTP_STATUS_NO_CONTENT });

    // 개행이 살아 있으면 awslogs 드라이버가 stdout을 **줄마다** 로그 이벤트로 쪼개
    // 위조 줄이 생기고, 개행이 없어도 따옴표 구문 필터는 줄 안 어디서든 맞는다 —
    // 둘 다 `escapeForLog`가 막는다(그 JSDoc 참고).
    console.error('[client-error]', escapeForLog(raw));
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}
