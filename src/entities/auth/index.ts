// DrizzleSessionRepository는 barrel에서 제외 — api.ts가 @/shared/db/schema(import 'server-only')를
// import하므로 client component가 barrel을 import하면 build가 깨진다.
// server 소비자는 @/entities/auth/api에서 직접 deep import한다.
//
// DrizzleUserRepository도 barrel에서 제외 — 같은 이유로 api.ts가 server-only 의존성을 갖는다.
// server 소비자는 @/entities/auth/api에서 직접 deep import한다.
//
// getCurrentUser는 barrel에서 제외 — next/headers 의존이 client 번들에 포함되는 문제 방지.
// 서버 소비자는 @/entities/auth/lib/getCurrentUser에서 직접 import한다.
//
// getAuthDatabaseClient / resetAuthDatabaseClientForTests도 barrel에서 제외 —
// @/shared/db/client → require('./clientTest') → import 'server-only' 체인이
// client 번들에 유입되는 문제 방지 (useCurrentUser를 import하는 'use client' 컴포넌트가
// 같은 barrel을 통해 server-only 모듈까지 끌어오면 next build 실패).
// 서버 소비자는 @/entities/auth/lib/db에서 직접 import한다.
//
// bcryptPasswordHasher / bcryptPasswordVerifier는 barrel에서 제외 — bcrypt는 Node.js 네이티브
// 의존성이 있어 client bundle에 포함되면 build가 깨진다.
// server 소비자는 @/entities/auth/lib/bcrypt에서 직접 import한다.
//
// tokenUtils(generateUrlSafeToken 등)도 barrel에서 제외 — `node:crypto` import가
// Next의 자동 브라우저 폴리필(crypto-browserify, 약 414KB)을 client 번들로 끌어온다.
// 위 항목들과 달리 이건 build를 깨지 않고 **조용히 번들에 실려서** 오래 방치됐다
// (전 라우트 first-load에 포함돼 있었다). 재발하면 즉시 실패하도록
// tokenUtils.ts에 `import 'server-only'`를 두었다.
// server 소비자는 @/entities/auth/lib/tokenUtils에서 직접 import한다.

// --- user lib fns ---
export { loginUser } from './lib/loginUser';
export { logoutUser } from './lib/logoutUser';
export { registerUser } from './lib/registerUser';
export { findUserBySessionToken } from './lib/findUserBySessionToken';
export { deleteAccount } from './lib/deleteAccount';
export { confirmPasswordReset } from './lib/confirmPasswordReset';
export { requestPasswordReset } from './lib/requestPasswordReset';
export { requestEmailVerification } from './lib/requestEmailVerification';
export { verifyEmail } from './lib/verifyEmail';
export type {
    SocialLoginUserInput,
    RegisterUserInput,
    RegisterUserResult,
    RegisterUserDependencies,
    LoginUserInput,
    LoginUserError,
    AuthSessionCookie,
    AuthSessionOptions,
    LoginUserDependencies,
    LoginUserOptions,
    LoginUserResult,
    LogoutUserInput,
    LogoutUserDependencies,
    LogoutUserOptions,
    LogoutUserResult,
    FindUserBySessionTokenDependencies,
    FindUserBySessionTokenOptions,
    DeleteAccountInput,
    DeleteAccountDependencies,
    DeleteAccountOptions,
    DeleteAccountError,
    DeleteAccountResult,
    RequestPasswordResetInput,
    RequestPasswordResetDependencies,
    RequestPasswordResetOptions,
    RequestPasswordResetResult,
    ConfirmPasswordResetInput,
    ConfirmPasswordResetResult,
    ConfirmPasswordResetDependencies,
    RequestEmailVerificationInput,
    RequestEmailVerificationDependencies,
    RequestEmailVerificationOptions,
    RequestEmailVerificationResult,
    VerifyEmailInput,
    VerifyEmailError,
    VerifyEmailDependencies,
    VerifyEmailResult,
} from './lib/authUseCaseTypes';
export type {
    ConfirmPasswordResetError,
    ConfirmPasswordResetErrorCode,
    DeleteAccountErrorCode,
    LoginUserErrorCode,
    RegisterUserError,
    RegisterUserErrorCode,
    RegisterUserErrorField,
    VerifyEmailErrorCode,
} from './lib/authUseCaseTypes';

// --- session cookie / session builders ---
export {
    AUTH_SESSION_COOKIE_NAME,
    DEFAULT_SESSION_TTL_SECONDS,
    createSessionCookie,
    createExpiredSessionCookie,
    createAuthSession,
} from './lib/sessionCookie';
export type { CreateAuthSessionResult } from './lib/sessionCookie';
export { isSecureCookieEnv } from './lib/sessionCookieOptions';
export { applyAuthCookie } from './lib/applyAuthCookie';
export {
    createAuthHintCookie,
    createExpiredAuthHintCookie,
} from './lib/authHintCookie';
export type { AuthHintCookieDescriptor } from './lib/authHintCookie';
export {
    AUTH_SERVICE_UNAVAILABLE_MESSAGE,
    CONSENT_REQUIRED_MESSAGE,
    OAUTH_ERROR_REDIRECT,
} from './lib/errorMessages';
export type {
    ResponseCookie,
    PasswordHasher,
    PasswordVerifier,
} from './lib/types';

// --- hooks ---
export { useCurrentUser } from './hooks/useCurrentUser';
export { useAuthHint } from './hooks/useAuthHint';
