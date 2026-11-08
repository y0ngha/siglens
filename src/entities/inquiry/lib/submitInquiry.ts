import type { ContactInput } from '../api';
import { buildInquiryNotification } from '../templates/operator-mail/buildInquiryNotification';
import type { SubmitInquiryDeps } from './types';

/**
 * 검증된 문의를 주입된 repository로 저장한 뒤 운영자에게 알린다. 액션이 DB·메일
 * 구현을 조립해 넘긴다.
 *
 * 저장 실패는 그대로 던진다(사용자가 재시도해야 한다). 알림은 저장이 끝난 **뒤**에만
 * 예약하며, 발송 실패 처리는 주입된 notifier가 맡는다(문의는 이미 저장됐다).
 */
export async function submitInquiry(
    input: ContactInput,
    deps: SubmitInquiryDeps
): Promise<void> {
    await deps.contactRepository.create(input);
    deps.notifier(buildInquiryNotification(input));
}
