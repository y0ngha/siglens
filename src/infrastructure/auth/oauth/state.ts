import { randomBytes, timingSafeEqual } from 'crypto';
import type { OAuthProvider } from '@y0ngha/siglens-core';
import type { ResponseCookie } from '../types';
import { isSecureCookieEnv } from '../sessionCookieOptions';

/** OAuth state 쿠키 이름. */
export const OAUTH_STATE_COOKIE_NAME = 'siglens_oauth_state';

/** OAuth state 쿠키 TTL (5분). */
export const OAUTH_STATE_TTL_SECONDS = 5 * 60;

interface StatePayload {
    state: string;
    provider: OAuthProvider;
    next: string;
    exp: number;
}

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

/** state 발급 — 쿼리에 실릴 토큰과 HttpOnly 쿠키 메타를 함께 반환. */
export function issueOAuthState(
    provider: OAuthProvider,
    next: string,
    now: Date = new Date()
): { state: string; cookie: ResponseCookie } {
    const state = randomBytes(32).toString('base64url');
    const expMs = now.getTime() + OAUTH_STATE_TTL_SECONDS * 1000;
    const payload: StatePayload = { state, provider, next, exp: expMs };
    const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
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

/** state 검증 — 쿠키 ↔ 쿼리 토큰 timing-safe 비교 + provider/만료 검사. */
export function verifyOAuthState(
    provider: OAuthProvider,
    queryState: string,
    cookieValue: string | undefined,
    now: Date = new Date()
): { ok: true; next: string } | { ok: false } {
    if (!cookieValue) return { ok: false };
    let payload: StatePayload;
    try {
        const json = Buffer.from(cookieValue, 'base64url').toString('utf-8');
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
