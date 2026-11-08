import { buildFeedbackDigest } from '@/entities/feedback/lib/buildFeedbackDigest';
import { FEEDBACK_RETENTION_MS } from '@/entities/feedback/lib/constants';
import { renderFeedbackDigest } from '@/entities/feedback/templates/operator-mail/renderFeedbackDigest';
import type { FeedbackRepository } from '@/entities/feedback/lib/types';
import { MS_PER_DAY } from '@/shared/config/time';
import type { EmailMessage } from '@/shared/email/types';

export interface FeedbackDigestDeps {
    repository: Pick<
        FeedbackRepository,
        'listAiFeedbackSince' | 'deleteOlderThan'
    >;
    notifier: (message: Omit<EmailMessage, 'to'>) => Promise<boolean>;
}

/**
 * 일일 요약 한 번: 지난 24시간 👍/👎를 운영자에게 메일로 보내고(0건이면 생략),
 * 보관 기간(365일)이 지난 피드백 행을 삭제한다.
 *
 * 요약과 파기는 서로 독립이다 — 메일 단계가 실패해도 파기는 계속 시도한다
 * (파기가 처리방침의 약속이다). 둘 다 멱등이라 락이 필요 없다: 요약은 읽기,
 * 파기는 조건 삭제다.
 */
export async function runFeedbackDigest(
    now: Date,
    deps: FeedbackDigestDeps
): Promise<void> {
    try {
        const rows = await deps.repository.listAiFeedbackSince(
            new Date(now.getTime() - MS_PER_DAY)
        );
        if (rows.length === 0) {
            console.log('[feedback-digest] no feedback in the last 24h');
        } else {
            const mail = renderFeedbackDigest(buildFeedbackDigest(rows), now);
            const sent = await deps.notifier(mail);
            console.log(
                `[feedback-digest] digest ${sent ? 'sent' : 'not sent'}: ${rows.length} rows`
            );
        }
    } catch (error) {
        console.error('[feedback-digest] digest failed:', error);
    }

    try {
        const purged = await deps.repository.deleteOlderThan(
            new Date(now.getTime() - FEEDBACK_RETENTION_MS)
        );
        console.log(`[feedback-digest] purged ${purged} rows past retention`);
    } catch (error) {
        console.error('[feedback-digest] purge failed:', error);
    }
}
