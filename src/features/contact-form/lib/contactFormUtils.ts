import type { ContactFormError, ContactFormField } from '@/shared/lib/types';
import { CONTACT_ERROR_KEY } from '@/shared/lib/contactErrorMessages';
import {
    CONTACT_CONTENT_MAX_LENGTH,
    CONTACT_TITLE_MAX_LENGTH,
} from '@/shared/config/contact';

/**
 * 번역자를 인자로 받는다 — 이 모듈은 훅을 부를 수 없는 순수 함수다.
 * 네임스페이스는 `shared.lib.contactError`.
 */
export type ContactErrorTranslator = (
    key: string,
    values?: Record<string, number>
) => string;

/**
 * 길이 제한 메시지 두 개만 `{v0}`을 받는다. 코드마다 값을 갈라 주는 대신 두
 * 상한을 항상 함께 넘겨도 되지만, 그러면 `{v0}`이 어느 상한인지 코드에서
 * 읽히지 않는다 — 코드별로 명시한다.
 */
function valuesFor(code: ContactFormError['code']) {
    if (code === 'title_too_long') return { v0: CONTACT_TITLE_MAX_LENGTH };
    if (code === 'content_too_long') return { v0: CONTACT_CONTENT_MAX_LENGTH };
    return undefined;
}

function message(
    code: ContactFormError['code'],
    t: ContactErrorTranslator
): string {
    return t(CONTACT_ERROR_KEY[code], valuesFor(code));
}

export function getFieldError(
    error: ContactFormError | null,
    field: ContactFormField,
    t: ContactErrorTranslator
): string | undefined {
    return error?.field === field ? message(error.code, t) : undefined;
}

export function getSubmissionError(
    error: ContactFormError | null,
    t: ContactErrorTranslator
): string | undefined {
    return error && error.field === undefined
        ? message(error.code, t)
        : undefined;
}
