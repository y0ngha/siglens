/**
 * 인증 에러 **코드** → 메시지 키.
 *
 * `shared`에 둔다. `entities/auth` 배럴은 `verifyEmail → tokenUtils → node:crypto`를
 * 끌고 오므로, 클라이언트 컴포넌트가 그 배럴을 import하면 번들이 깨진다
 * (v0.58.0에서 같은 결함군을 겪었다). 이 표는 도메인 의존이 없는 순수 상수라
 * `shared`가 올바른 자리이기도 하다.
 *
 * use-case 라이브러리(`loginUser`·`registerUser`·`verifyEmail` 등)는 순수
 * 함수라 요청 스코프가 없다 — 거기서 번역하면 단위 테스트가 프로바이더를
 * 요구하게 되고, 서버 액션이 아닌 경로에서는 아예 동작하지 않는다. 그래서
 * 그 라이브러리들은 **코드**를 돌려주고, 표시는 UI 경계에서 한다.
 *
 * 라이브러리가 함께 돌려주는 `message`는 로그·폴백용 한국어 원문으로 남는다 —
 * 화면에 그대로 나가면 안 되고, 코드가 이 표에 없을 때의 마지막 방어선이다.
 */
export const AUTH_ERROR_KEY: Record<string, string> = {
    invalid_credentials: 'error.invalidCredentials',
    email_already_exists: 'error.emailAlreadyExists',
    email_verification_required: 'error.emailVerificationRequired',
    invalid_input: 'error.consentInvalid',
    consent_required: 'error.consentRequired',
    invalid_code: 'error.invalidCode',
    expired_code: 'error.expiredCode',
    invalid_token: 'error.invalidResetToken',
    expired_token: 'error.expiredResetToken',
    same_password: 'error.samePassword',
    user_not_found: 'error.userNotFound',
    not_authenticated: 'error.notAuthenticated',
    email_mismatch: 'error.emailMismatch',
    service_unavailable: 'error.serviceUnavailable',
    redis_unavailable: 'error.redisUnavailable',
    email_not_verified: 'error.emailNotVerified',
    invalid_email: 'error.emailInvalid',
    weak_password: 'error.passwordWeak',
    // OAuth 콜백이 `?error=` 쿼리로 넘기는 코드들. 별도 표를 두면 로그인 화면이
    // 두 표를 조회해야 하고, 실제로 예전엔 그 두 번째 표만 한국어 리터럴이라
    // `/en/login`이 영어 폼 위에 한국어 배너를 띄웠다.
    oauth_email_conflict: 'error.oauthEmailConflict',
    oauth_profile_invalid: 'error.oauthProfileInvalid',
    oauth_unknown: 'error.oauthUnknown',
    oauth_consent_invalid: 'error.oauthConsentInvalid',
    oauth_consent_expired: 'error.oauthConsentExpired',
};
