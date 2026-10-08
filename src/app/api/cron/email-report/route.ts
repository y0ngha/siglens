import { constants } from 'node:http2';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
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
    afterWithDrain(() =>
        runAsBatchWork(async () => {
            try {
                const counts = await runEmailReportBatch(
                    createEmailReportDeps(secret, now),
                    now
                );
                console.log('[email-report] run done:', JSON.stringify(counts));
            } catch (error) {
                console.error('[email-report] run failed:', error);
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
