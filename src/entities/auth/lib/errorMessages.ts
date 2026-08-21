// 이 상수들은 **로그·폴백용 한국어 원문**이다 — 화면에 그대로 나가면 안 된다.
// 표시는 UI 경계에서 에러 `code`로 번역한다(`lib/authErrorKey.ts` 참고).
// 예전 주석은 "단일 로케일 제품이라 한국어 전용"이라고 했는데 그 전제는 더 이상
// 참이 아니다. Sibling: lib/contactErrorMessages.ts.

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
