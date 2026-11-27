import { constants } from 'node:http2';
import { isE2E } from '@/shared/api/e2eEnv';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { ThrottledEmailDispatcher } from '@/shared/email/ThrottledEmailDispatcher';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { scheduleMailAlertPass } from './scheduleMailAlertPass';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * E2E·로컬 검증이 시계를 고정하는 헤더(ISO 시각). `E2E_TEST=1`일 때만 읽는다. 라우트 파일은 HTTP 메서드와
 * 라우트 설정만 내보낼 수 있어 이 상수는 내보내지 않는다.
 */
const E2E_NOW_HEADER = 'x-siglens-e2e-now';

function resolveNow(request: Request): Date {
    if (!isE2E()) return new Date();
    const raw = request.headers.get(E2E_NOW_HEADER);
    if (raw === null) return new Date();
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * 알림 메일 패스를 직접 돌리는 라우트. 운영에서는 매시 도는 이메일 리포트 cron이 같은 패스를 함께
 * 부르므로(`/api/cron/email-report`) 이 라우트에는 EventBridge 규칙이 없다 — 수동·로컬 실행용이다.
 * 202를 먼저 돌려주고 `after()`로 돈다. 발송 시각(한국 시간 7시·8시)이 아니거나 공개 전이면 바로 끝난다.
 *
 * **한국 시간 7시·8시 슬롯에는 돌리지 않는다.** 이 라우트는 자기 발송 속도 제한기를 따로 만들어, 같은 시각에 도는
 * 이메일 리포트 cron의 제한기와 합쳐지지 않는다(두 풀이 Resend 초당 한도를 함께 넘을 수 있다).
 *
 * 운영에서는 시계를 바꿀 수 없다: 시각 재정의 헤더는 `E2E_TEST=1`일 때만 읽는다.
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }
    scheduleMailAlertPass({
        now: resolveNow(request),
        dispatcher: new ThrottledEmailDispatcher(createEmailDispatcher()),
    });
    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
