import 'server-only';
import type { EmailReportSubscriptionRepository } from '@/shared/db/types';
import { verifyReportValue } from './lib/reportSignature';

export type UnsubscribeOutcome = 'ok' | 'invalid';

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 서명된 수신거부 요청을 처리한다. 확인 페이지의 Server Action과 원클릭 API가 함께 쓴다.
 *
 * 구독 행이 없는 회원(탈퇴 후 옛 메일의 링크 등)도 `ok`다 — "이미 받지 않는 상태"가
 * 회원이 원한 결과이고, 회원 존재 여부를 응답으로 흘리지 않는다.
 */
export async function unsubscribeWithSignature(
    repo: Pick<EmailReportSubscriptionRepository, 'disable'>,
    secret: string | null,
    userId: string,
    signature: string
): Promise<UnsubscribeOutcome> {
    if (
        secret === null ||
        !UUID_RE.test(userId) ||
        !verifyReportValue(secret, 'unsubscribe', userId, signature)
    ) {
        return 'invalid';
    }
    await repo.disable(userId);
    return 'ok';
}
