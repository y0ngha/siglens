/**
 * OAuth CSRF state: 시작 라우트가 발급한 HMAC 서명 쿠키를 콜백 라우트가 쿼리
 * `state`와 대조한다. 돌아갈 곳(`next`)도 서명된 payload에 실려 콜백까지 변조
 * 없이 전달된다.
 */
import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { SupportedOAuthProvider } from '@/shared/lib/types';
import { isSecureCookieEnv } from '@/entities/auth/lib/sessionCookieOptions';
import { type ResponseCookie } from '@/entities/auth/lib/types';

/** 시작 라우트가 심고 콜백 라우트가 읽는 state 쿠키 이름. 바꾸면 진행 중인 로그인이 콜백에서 실패한다. */
export const OAUTH_STATE_COOKIE_NAME = 'siglens_oauth_state';

const OAUTH_STATE_TTL_MINUTES = 5;
/** OAuth state 쿠키·payload의 수명(초). provider 화면에서 머무를 수 있는 시간의 상한이다. */
export const OAUTH_STATE_TTL_SECONDS = OAUTH_STATE_TTL_MINUTES * 60;

/** Minimum acceptable byte length for OAUTH_STATE_HMAC_SECRET. 32 bytes ≈ 256-bit secret. */
const HMAC_SECRET_MIN_BYTES = 32;
const STATE_TOKEN_BYTES = 32;
const SIGNATURE_SEPARATOR = '.';

/**
 * OAUTH_STATE_HMAC_SECRET 미설정 또는 최소 바이트 미달 시 발생.
 * Route handler는 이 오류를 잡아 fail-closed 처리한다 (서명 없는 state로 폴백 금지).
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
    return createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64url');
}

/** 길이가 다르면 `timingSafeEqual`이 throw하므로 길이부터 비교한다. */
function constantTimeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a, 'utf-8');
    const bBuf = Buffer.from(b, 'utf-8');
    return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

/**
 * 발급 쿠키와 만료 쿠키가 같은 속성을 공유해야 브라우저가 같은 쿠키로 보고 덮어쓴다.
 * `SameSite=Lax`인 이유: provider에서 돌아오는 콜백은 cross-site top-level GET이라
 * `Strict`면 쿠키가 실리지 않는다.
 */
function stateCookie(
    value: string,
    expires: Date,
    maxAge: number
): ResponseCookie {
    return {
        name: OAUTH_STATE_COOKIE_NAME,
        value,
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        expires,
        maxAge,
    };
}

/** 서명이 맞는 쿠키의 payload만 디코드한다. 서명 불일치·형식 오류는 모두 `null`. */
function readSignedPayload(
    cookieValue: string,
    secret: Buffer
): StatePayload | null {
    const separatorIndex = cookieValue.indexOf(SIGNATURE_SEPARATOR);
    if (separatorIndex === -1) return null;
    const encodedPayload = cookieValue.slice(0, separatorIndex);
    const providedSignature = cookieValue.slice(separatorIndex + 1);
    if (!encodedPayload || !providedSignature) return null;
    if (
        !constantTimeEquals(
            signPayload(encodedPayload, secret),
            providedSignature
        )
    )
        return null;
    try {
        const json = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
        const parsed: unknown = JSON.parse(json);
        return isStatePayload(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** state 발급 — 쿼리에 실릴 토큰과 HttpOnly 쿠키 메타를 함께 반환. */
export function issueOAuthState(
    provider: SupportedOAuthProvider,
    next: string,
    now: Date = new Date()
): OAuthStateIssueResult {
    const secret = readHmacSecret();
    const state = randomBytes(STATE_TOKEN_BYTES).toString('base64url');
    const expMs = now.getTime() + OAUTH_STATE_TTL_SECONDS * 1000;
    const payload: StatePayload = { state, provider, next, exp: expMs };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url'
    );
    const signature = signPayload(encodedPayload, secret);
    const value = `${encodedPayload}${SIGNATURE_SEPARATOR}${signature}`;
    return {
        state,
        cookie: stateCookie(value, new Date(expMs), OAUTH_STATE_TTL_SECONDS),
    };
}

/** state 만료 쿠키 — 콜백 처리 후 즉시 폐기 용도. */
export function expiredOAuthStateCookie(): ResponseCookie {
    return stateCookie('', new Date(0), 0);
}

/** state 검증 — 쿠키↔쿼리 timing-safe + provider/만료/HMAC 서명 검사 (HMAC 미설정 시 throw → fail-closed). */
export function verifyOAuthState(
    provider: SupportedOAuthProvider,
    queryState: string,
    cookieValue: string | undefined,
    now: Date = new Date()
): OAuthStateVerifyResult {
    const secret = readHmacSecret();
    if (!cookieValue) return { ok: false };
    const payload = readSignedPayload(cookieValue, secret);
    if (payload === null) return { ok: false };
    if (payload.provider !== provider) return { ok: false };
    if (payload.exp < now.getTime()) return { ok: false };
    if (!constantTimeEquals(payload.state, queryState)) return { ok: false };
    return { ok: true, next: payload.next };
}
