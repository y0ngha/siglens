import 'server-only';
import { readEmailReportSecret } from '@/entities/email-report/emailReportSecret';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import type { EmailDispatcher } from '@/shared/email/types';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { createMailAlertBatchDeps } from './createMailAlertDeps';
import { runMailAlertBatch } from './runMailAlertBatch';

/**
 * 응답을 돌려준 뒤 알림 메일 패스를 돌리도록 예약한다. 메일 리포트 cron(매시)이 자기 패스와 나란히 부르고,
 * 수동·로컬 실행용 라우트(`PATCH /api/cron/mail-alert`)도 같은 함수를 쓴다.
 *
 * 패스는 자기 실패를 스스로 삼킨다 — 같은 요청의 다른 패스(메일 리포트)가 이 패스의 예외로 멈추면 안 된다.
 * 발송 시각이 아니거나 공개 전이면 `runMailAlertBatch`가 바로 끝난다.
 */
export function scheduleMailAlertPass(options: {
    readonly now: Date;
    readonly dispatcher: EmailDispatcher;
}): void {
    afterWithDrain(() =>
        runAsBatchWork(async () => {
            try {
                const result = await runMailAlertBatch(
                    createMailAlertBatchDeps(
                        readEmailReportSecret(),
                        options.dispatcher
                    ),
                    options.now
                );
                if (result.status === 'done') {
                    console.log(
                        '[mail-alert] run done:',
                        JSON.stringify(result.counts)
                    );
                }
            } catch (error) {
                console.error(
                    '[mail-alert] run failed:',
                    redactDbErrorForLog(error)
                );
            }
        })
    );
}
