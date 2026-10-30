// 이 상수들은 **로그·폴백용 한국어 원문**이다 — 화면에 그대로 나가면 안 된다.
// 표시는 UI 경계에서 에러 `code`로 번역한다(`lib/authErrorKey.ts` 참고).
// Sibling: lib/contactErrorMessages.ts.

/** 인증 서버 액션이 DB·Redis 장애를 사용자에게 알릴 때의 폴백 문구. 화면에는 `code`로 번역해 쓴다. */
export const AUTH_SERVICE_UNAVAILABLE_MESSAGE =
    '서비스가 일시적으로 동작하지 않습니다. 잠시 후 다시 시도해주세요.';

/** 약관·개인정보 동의가 빠진 가입 요청의 폴백 문구. 화면에는 `code`로 번역해 쓴다. */
export const CONSENT_REQUIRED_MESSAGE =
    '개인정보처리방침과 이용약관에 동의해주세요.';

/**
 * OAuth 동의 흐름의 리다이렉트 대상. `error=` 코드는 `AUTH_ERROR_KEY`(`shared/lib/authErrorKey.ts`)의
 * 키여야 한다 — 로그인 화면(`login/_lib/loginErrorKey.ts`)이 그 표로만 배너 문구를 찾는다.
 */
export const OAUTH_ERROR_REDIRECT = {
    consentInvalid: '/login?error=oauth_consent_invalid',
    consentExpired: '/login?error=oauth_consent_expired',
    serviceUnavailable: '/login?error=service_unavailable',
    emailConflict: '/login?error=oauth_email_conflict',
} as const;
