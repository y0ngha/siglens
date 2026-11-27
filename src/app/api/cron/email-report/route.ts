import { constants } from 'node:http2';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { createEmailDispatcher } from '@/shared/email/dispatcher';
import { ThrottledEmailDispatcher } from '@/shared/email/ThrottledEmailDispatcher';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { scheduleMailAlertPass } from '../mail-alert/scheduleMailAlertPass';
import { createEmailReportDeps } from './createEmailReportDeps';
import { runEmailReportBatch } from './runEmailReportBatch';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * 회원 정기 메일 리포트 cron — EventBridge가 매시 정각에 부른다.
 *
 * 202를 먼저 돌려주고 `after()`로 돈다(API Destination 타임아웃 ~5s). 회원마다 로컬
 * 요일·시를 계산해 이번 시각이 발송 슬롯인 회원에게만 보낸다.
 *
 * **Redis 락이 없는 이유:** 중복 발송은 DB가 막는다 — `(user, 로컬 날짜)` 유니크 행을
 * 보내기 전에 선점하므로, 겹친 두 실행이 같은 회원을 동시에 처리해도 한 쪽만 보낸다.
 * 겹침의 비용은 이미 선점된 회원을 건너뛰는 조회뿐이다.
 *
 * 서명 비밀값이 없으면 아무것도 보내지 않는다 — 수신거부 링크가 동작하지 않는 메일이
 * 나가면 안 된다.
 *
 * **알림 메일 패스를 함께 시작한다.** 한국 시간 7시·8시에만 일하는 패스(`runMailAlertBatch`)가 같은 매시
 * 트리거에 얹혀 EventBridge 규칙을 늘리지 않는다. 두 패스는 서로의 마감(CC-13)과 실패에 영향받지 않게 각자
 * `after()` 작업이고, **발송기 하나를 공유한다** — 워커 풀이 각각 4개라 따로 보내면 Resend 초당 한도를 합쳐
 * 넘고, 한도를 넘은 요청은 거절(`false`)되어 그 메일은 사라진다.
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    const secret = readEmailReportSecret();
    if (secret === null) {
        console.error(
            '[email-report] EMAIL_REPORT_SIGNING_SECRET missing — skipping run'
        );
        return new Response(null, { status: HTTP_STATUS_ACCEPTED });
    }

    const now = new Date();
    const dispatcher = new ThrottledEmailDispatcher(createEmailDispatcher());
    afterWithDrain(() =>
        runAsBatchWork(async () => {
            try {
                const counts = await runEmailReportBatch(
                    createEmailReportDeps(secret, now, dispatcher),
                    now
                );
                console.log('[email-report] run done:', JSON.stringify(counts));
            } catch (error) {
                console.error(
                    '[email-report] run failed:',
                    redactDbErrorForLog(error)
                );
            }
        })
    );

    // 메일 리포트 패스는 이미 예약됐다. 알림 패스를 예약하다 던져도(`after()` 문맥 문제 등) 202와 리포트는 지킨다.
    try {
        scheduleMailAlertPass({ now, dispatcher });
    } catch (error) {
        console.error(
            '[mail-alert] could not schedule pass:',
            redactDbErrorForLog(error)
        );
    }

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
