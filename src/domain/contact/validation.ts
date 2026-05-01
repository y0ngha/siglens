import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_EMAIL_PATTERN,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/domain/contact/constants';
import type {
    ContactFormError,
    ContactFormField,
    ContactFormValues,
} from '@/domain/types';

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
        return failure('title_required', 'title');
    }
    if (title.length > CONTACT_TITLE_MAX_LENGTH) {
        return failure('title_too_long', 'title');
    }
    if (email.length === 0) {
        return failure('email_required', 'email');
    }
    if (!CONTACT_EMAIL_PATTERN.test(email)) {
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
