import type {
    ContactFormError,
    ContactFormField,
    ContactFormValues,
} from '@/shared/lib/types';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_EMAIL_PATTERN,
    CONTACT_TITLE_MAX_LENGTH,
} from './constants';

/** 검증을 통과한 trim된 입력값. */
interface ValidationSuccess {
    ok: true;
    values: ContactFormValues;
}

/** 검증 실패 결과. 폼이 해당 필드에 오류 문구를 표시하는 데 쓴다. */
export interface ValidationFailure {
    ok: false;
    error: ContactFormError;
}

/** `validateContactInput`의 판별 유니온 결과. */
export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * 문의 폼 입력을 trim한 뒤 필수·길이·이메일 형식을 순서대로 검사한다.
 * 서버 액션이 신뢰 경계에서 호출하므로 클라이언트 검증과 별개로 항상 수행된다.
 */
export function validateContactInput(raw: ContactFormValues): ValidationResult {
    const title = raw.title.trim();
    const email = raw.email.trim();
    const content = raw.content.trim();

    if (title.length === 0) {
        return failure('title_required', 'title');
    }
    if (title.length > CONTACT_TITLE_MAX_LENGTH) {
        return failure('title_too_long', 'title');
    }
    if (email.length === 0) {
        return failure('email_required', 'email');
    }
    if (
        email.length > CONTACT_EMAIL_MAX_LENGTH ||
        !CONTACT_EMAIL_PATTERN.test(email)
    ) {
        return failure('email_invalid', 'email');
    }
    if (content.length === 0) {
        return failure('content_required', 'content');
    }
    if (content.length > CONTACT_CONTENT_MAX_LENGTH) {
        return failure('content_too_long', 'content');
    }

    return { ok: true, values: { title, email, content } };
}

function failure(
    code: ContactFormError['code'],
    field: ContactFormField
): ValidationFailure {
    return { ok: false, error: { code, field } };
}
