// DrizzleSessionRepository は barrel から除外 —
// api.ts が @/shared/db/schema (import 'server-only') を import するため
// client component が barrel を import すると build が壊れる。
// server consumer は @/entities/session/api から直接 deep import する。
// getCurrentUser は barrel から除外 — next/headers 의존이 client 번들에 포함되는 문제 방지.
// 서버 소비자는 @/entities/session/lib/getCurrentUser에서 직접 import.
// getAuthDatabaseClient도 barrel에서 제외 — @/shared/db/client → require('./clientTest') →
// import 'server-only' 체인이 client 번들에 유입되는 문제 방지 (useCurrentUser를 import하는
// 'use client' 컴포넌트가 같은 barrel을 통해 server-only 모듈까지 끌어오면 next build 실패).
// 서버 소비자는 @/entities/session/lib/db에서 직접 import.
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
    generateUrlSafeToken,
    generateNumericCode,
    hashEmailToken,
    safeCompareTokenHashes,
} from './lib/tokenUtils';
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
// bcryptPasswordHasher / bcryptPasswordVerifier は barrel から除外 —
// bcrypt は Node.js ネイティブ依存のため client bundle に入ると build が壊れる。
// server consumer は @/entities/session/lib/bcrypt から直接 deep import する。
export { useCurrentUser } from './hooks/useCurrentUser';
export { useAuthHint } from './hooks/useAuthHint';
