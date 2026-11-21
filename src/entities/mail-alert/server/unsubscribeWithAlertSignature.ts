import 'server-only';
import type { MailAlertSubscriberRepository } from '@/shared/db/types';
import { verifyMailAlertUnsubscribe } from '../lib/mailAlertLinks';

/** `invalid`는 서명 불일치·비밀값 없음·형식 오류를 구분하지 않는다 — 호출자가 이유를 알 필요가 없다. */
export type AlertUnsubscribeOutcome = 'ok' | 'invalid';

/**
 * 메일 앱의 원클릭 수신거부(RFC 8058)를 처리한다. 서명(`alert-unsubscribe`)이 맞으면 구독자 행을 지운다 —
 * 항목과 발송 기록은 연쇄로 함께 지워진다. 소유자는 서명된 링크(`{ kind: 'link' }`)라 비회원 행과 회원에게
 * 연결된 행을 같은 방식으로 지운다. 서명이 권한이므로 id만 맞고 서명이 없으면 아무것도 지우지 않는다.
 *
 * 이미 지워진 구독자(두 번 누른 링크, 탈퇴)도 `ok`다 — "이미 받지 않는 상태"가 원한 결과이고, 구독자의
 * 존재 여부를 응답으로 흘리지 않는다.
 */
export async function unsubscribeWithAlertSignature(
    subscribers: Pick<MailAlertSubscriberRepository, 'deleteByOwner'>,
    secret: string | null,
    subscriberId: string,
    signature: string
): Promise<AlertUnsubscribeOutcome> {
    if (
        secret === null ||
        !verifyMailAlertUnsubscribe(secret, subscriberId, signature)
    ) {
        return 'invalid';
    }
    await subscribers.deleteByOwner({ kind: 'link', subscriberId });
    return 'ok';
}
