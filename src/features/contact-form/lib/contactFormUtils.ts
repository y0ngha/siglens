import type {
    ContactFormError,
    ContactFormField,
    ContactFormState,
} from '@/shared/lib/types';
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

/** `field`에 걸린 오류의 번역 문구. 다른 필드 오류거나 오류가 없으면 `undefined`. */
export function getFieldError(
    error: ContactFormError | null,
    field: ContactFormField,
    t: ContactErrorTranslator
): string | undefined {
    return error?.field === field ? message(error.code, t) : undefined;
}

/** 특정 필드에 묶이지 않은 폼 단위 오류(전송 실패)의 번역 문구 — 폼 상단 배너용. */
export function getSubmissionError(
    error: ContactFormError | null,
    t: ContactErrorTranslator
): string | undefined {
    return error && error.field === undefined
        ? message(error.code, t)
        : undefined;
}

/**
 * 이메일 입력(비제어)의 기본값. 액션이 오류로 돌아온 뒤에는 사용자가 친 값을
 * 그대로 되살려야 한다 — 로그인 이메일로 덮으면 입력을 지운다. 첫 렌더에는
 * 로그인 사용자의 이메일을 미리 채우고, 비로그인이면 빈 칸이다.
 */
export function resolveEmailDefault(
    state: ContactFormState,
    signedInEmail: string | undefined
): string {
    if (state.error) return state.values.email;
    return signedInEmail ?? '';
}
