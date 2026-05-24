export { DrizzleSessionRepository } from './api';
export { getCurrentUser } from './lib/getCurrentUser';
export { getAuthDatabaseClient } from './lib/db';
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
export { bcryptPasswordHasher, bcryptPasswordVerifier } from './lib/bcrypt';
