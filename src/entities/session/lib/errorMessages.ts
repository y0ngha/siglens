// Korean-only by design (single-locale product); future i18n keys map 1:1 to the constants in this file. Sibling: lib/contactErrorMessages.ts, entities/api-key/actions/saveApiKeyAction.ts.

export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
    '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.';

export const CONSENT_REQUIRED_MESSAGE =
    '개인정보처리방침과 이용약관에 동의해주세요.';

/** OAuth consent-flow redirect targets — must match keys in login/LoginContent.tsx OAUTH_ERROR_MESSAGES. */
export const OAUTH_ERROR_REDIRECT = {
    consentInvalid: '/login?error=oauth_consent_invalid',
    consentExpired: '/login?error=oauth_consent_expired',
    serviceUnavailable: '/login?error=service_unavailable',
    emailConflict: '/login?error=oauth_email_conflict',
} as const;
