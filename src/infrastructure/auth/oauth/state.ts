import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { SupportedOAuthProvider } from '@/domain/types';
import type { ResponseCookie } from '@/infrastructure/auth/types';
import { isSecureCookieEnv } from '@/infrastructure/auth/sessionCookieOptions';

/** OAuth state 쿠키 이름. */
export const OAUTH_STATE_COOKIE_NAME = 'siglens_oauth_state';

/** OAuth state 쿠키 TTL (5분). */
export const OAUTH_STATE_TTL_MINUTES = 5;
export const OAUTH_STATE_TTL_SECONDS = OAUTH_STATE_TTL_MINUTES * 60;

/** Minimum acceptable byte length for OAUTH_STATE_HMAC_SECRET. 32 bytes ≈ 256-bit secret. */
const HMAC_SECRET_MIN_BYTES = 32;
const SIGNATURE_SEPARATOR = '.';

/**
 * Domain error raised when OAUTH_STATE_HMAC_SECRET is missing or shorter than
 * {@link HMAC_SECRET_MIN_BYTES}. Caught by route handlers to fail closed (i.e.
 * refuse to issue/verify state) rather than fall back to unsigned payloads.
 */
export class OAuthStateSecretMisconfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OAuthStateSecretMisconfiguredError';
    }
}

interface StatePayload {
    state: string;
    provider: SupportedOAuthProvider;
    next: string;
    exp: number;
}

interface OAuthStateIssueResult {
    state: string;
    cookie: ResponseCookie;
}

type OAuthStateVerifyResult = { ok: true; next: string } | { ok: false };

function isStatePayload(value: unknown): value is StatePayload {
    if (typeof value !== 'object' || value === null) return false;
    // typeof + null checks above guarantee a non-null object; Record widens property probing only.
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.state === 'string' &&
        typeof candidate.provider === 'string' &&
        typeof candidate.next === 'string' &&
        typeof candidate.exp === 'number'
    );
}

function readHmacSecret(): Buffer {
    const raw = process.env.OAUTH_STATE_HMAC_SECRET;
    if (!raw) {
        throw new OAuthStateSecretMisconfiguredError(
            'OAUTH_STATE_HMAC_SECRET environment variable is required to sign OAuth state cookies'
        );
    }
    const secret = Buffer.from(raw, 'utf-8');
    if (secret.length < HMAC_SECRET_MIN_BYTES) {
        throw new OAuthStateSecretMisconfiguredError(
            `OAUTH_STATE_HMAC_SECRET must be at least ${HMAC_SECRET_MIN_BYTES} bytes`
        );
    }
    return secret;
}

function signPayload(encodedPayload: string, secret: Buffer): string {
    return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

/** state 발급 — 쿼리에 실릴 토큰과 HttpOnly 쿠키 메타를 함께 반환. */
export function issueOAuthState(
    provider: SupportedOAuthProvider,
    next: string,
    now: Date = new Date()
): OAuthStateIssueResult {
    const secret = readHmacSecret();
    const state = randomBytes(32).toString('base64url');
    const expMs = now.getTime() + OAUTH_STATE_TTL_SECONDS * 1000;
    const payload: StatePayload = { state, provider, next, exp: expMs };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
    );
    const signature = signPayload(encodedPayload, secret);
    const value = `${encodedPayload}${SIGNATURE_SEPARATOR}${signature}`;
    const cookie: ResponseCookie = {
        name: OAUTH_STATE_COOKIE_NAME,
        value,
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        expires: new Date(expMs),
        maxAge: OAUTH_STATE_TTL_SECONDS,
    };
    return { state, cookie };
}

/** state 만료 쿠키 — 콜백 처리 후 즉시 폐기 용도. */
export function expiredOAuthStateCookie(): ResponseCookie {
    return {
        name: OAUTH_STATE_COOKIE_NAME,
        value: '',
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        expires: new Date(0),
        maxAge: 0,
    };
}

/**
 * state 검증 — 쿠키 ↔ 쿼리 토큰 timing-safe 비교 + provider/만료/HMAC 서명 검사.
 * Throws {@link OAuthStateSecretMisconfiguredError} when OAUTH_STATE_HMAC_SECRET
 * is missing or invalid; callers must fail closed in that case.
 */
export function verifyOAuthState(
    provider: SupportedOAuthProvider,
    queryState: string,
    cookieValue: string | undefined,
    now: Date = new Date()
): OAuthStateVerifyResult {
    const secret = readHmacSecret();
    if (!cookieValue) return { ok: false };

    const separatorIndex = cookieValue.indexOf(SIGNATURE_SEPARATOR);
    if (separatorIndex === -1) return { ok: false };
    const encodedPayload = cookieValue.slice(0, separatorIndex);
    const providedSignature = cookieValue.slice(separatorIndex + 1);
    if (!encodedPayload || !providedSignature) return { ok: false };

    const expectedSignature = signPayload(encodedPayload, secret);
    const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
    const providedBuf = Buffer.from(providedSignature, 'utf-8');
    if (expectedBuf.length !== providedBuf.length) return { ok: false };
    if (!timingSafeEqual(expectedBuf, providedBuf)) return { ok: false };

    let payload: StatePayload;
    try {
        const json = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
        const parsed: unknown = JSON.parse(json);
        if (!isStatePayload(parsed)) return { ok: false };
        payload = parsed;
    } catch {
        return { ok: false };
    }
    if (payload.provider !== provider) return { ok: false };
    if (payload.exp < now.getTime()) return { ok: false };
    const a = Buffer.from(payload.state);
    const b = Buffer.from(queryState);
    if (a.length !== b.length) return { ok: false };
    if (!timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, next: payload.next };
}
