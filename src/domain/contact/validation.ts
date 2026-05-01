import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_EMAIL_PATTERN,
    CONTACT_TITLE_MAX_LENGTH,
} from './constants';
import type {
    ContactFormError,
    ContactFormField,
    ContactFormValues,
} from './formTypes';

export interface ValidationSuccess {
    ok: true;
    values: ContactFormValues;
}

export interface ValidationFailure {
    ok: false;
    error: ContactFormError;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateContactInput(raw: ContactFormValues): ValidationResult {
    const title = raw.title.trim();
    const email = raw.email.trim();
    const content = raw.content.trim();

    if (title.length === 0) {
        return failure('title_required', 'title', '제목을 입력해 주세요.');
    }
    if (title.length > CONTACT_TITLE_MAX_LENGTH) {
        return failure(
            'title_too_long',
            'title',
            `제목은 ${CONTACT_TITLE_MAX_LENGTH}자 이내로 입력해 주세요.`
        );
    }
    if (email.length === 0) {
        return failure('email_required', 'email', '이메일을 입력해 주세요.');
    }
    if (!CONTACT_EMAIL_PATTERN.test(email)) {
        return failure(
            'email_invalid',
            'email',
            '올바른 이메일 형식이 아닙니다.'
        );
    }
    if (content.length === 0) {
        return failure(
            'content_required',
            'content',
            '문의 내용을 입력해 주세요.'
        );
    }
    if (content.length > CONTACT_CONTENT_MAX_LENGTH) {
        return failure(
            'content_too_long',
            'content',
            `문의 내용은 ${CONTACT_CONTENT_MAX_LENGTH}자 이내로 입력해 주세요.`
        );
    }

    return { ok: true, values: { title, email, content } };
}

function failure(
    code: ContactFormError['code'],
    field: ContactFormField,
    message: string
): ValidationFailure {
    return { ok: false, error: { code, field, message } };
}
