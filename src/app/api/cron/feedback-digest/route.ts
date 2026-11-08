import { constants } from 'node:http2';
import { DrizzleFeedbackRepository } from '@/entities/feedback/api';
import { getDatabaseClient } from '@/shared/db/client';
import { notifyOperator } from '@/shared/email/operatorNotifier';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { runFeedbackDigest } from './runFeedbackDigest';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * AI 응답 피드백 일일 요약 + 보관 기간 파기 cron — EventBridge가 매일 00:05 UTC
 * (09:05 KST)에 부른다.
 *
 * 202를 먼저 돌려주고 `after()`로 돈다(API Destination 타임아웃 ~5s). 락이 없는
 * 이유: 요약은 읽기, 파기는 조건 삭제라 겹쳐 돌아도 결과가 같다. 겹침의 비용은
 * 요약 메일이 두 통 나갈 수 있다는 정도다.
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    const now = new Date();
    afterWithDrain(() =>
        runAsBatchWork(async () => {
            try {
                const { db } = getDatabaseClient();
                await runFeedbackDigest(now, {
                    repository: new DrizzleFeedbackRepository(db),
                    notifier: notifyOperator,
                });
            } catch (error) {
                console.error('[feedback-digest] run failed:', error);
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
