import type { ContactFormErrorCode } from '@/shared/lib/types';

/**
 * 문의 폼 에러 **코드** → `shared.lib.contactError` 메시지 키.
 *
 * 표시 문자열이 아닌 이유는 `authErrorKey.ts`와 같다 — 이 모듈은 순수 상수라
 * 요청 스코프가 없고, 여기서 한국어를 고정하면 `/en/contact`가 영어 폼에
 * 한국어 검증 메시지를 띄운다. 글자 수 상한은 값(`{v0}`)으로 넘긴다.
 */
export const CONTACT_ERROR_KEY: Record<ContactFormErrorCode, string> = {
    title_required: 'titleRequired',
    title_too_long: 'titleTooLong',
    email_required: 'emailRequired',
    email_invalid: 'emailInvalid',
    content_required: 'contentRequired',
    content_too_long: 'contentTooLong',
    submission_failed: 'submissionFailed',
};
