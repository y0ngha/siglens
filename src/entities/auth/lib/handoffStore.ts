import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';
import {
    isApiPath,
    localePath,
    splitLocalePath,
    type Locale,
} from '@/shared/i18n/locales';
import { sanitizeNextPath, toSameOriginPath } from '@/shared/lib/auth/redirect';
import { isSecureCookieEnv } from './sessionCookieOptions';
import type { ResponseCookie } from './types';

/** One-time code lifetime. The code only has to survive one 302 hop (spec §8). */
export const HANDOFF_TTL_SECONDS = 60;

/**
 * Lifetime of the ai-host SSO state cookie. It spans start → (main
 * host) issue → consume, all automatic redirects, so the OAuth-state 5-minute
 * window is ample.
 */
export const HANDOFF_STATE_TTL_SECONDS = 5 * 60;

const HANDOFF_STATE_COOKIE_BASE_NAME = 'siglens_ai_sso_state';

/**
 * Name of the browser-binding cookie set on the ai host by
 * `/api/auth/handoff/start` and read by `/api/auth/handoff/consume`.
 *
 * Production uses the `__Host-` prefix to stop cookie tossing: without it a
 * sibling subdomain (anything under `siglens.io`) could set
 * `siglens_ai_sso_state` with `Domain=siglens.io`, which the ai host would
 * also receive, and bind the victim's browser to a code minted for the
 * attacker's account. Browsers only accept a `__Host-` cookie that is
 * `Secure`, `Path=/` and has no `Domain`, so no other host can set it.
 *
 * Non-secure environments (dev/e2e over http) keep the plain name because
 * browsers reject `__Host-` without `Secure`. Both sides must call this, never
 * read a hard-coded name — a cookie under the other name is simply ignored.
 */
export function handoffStateCookieName(): string {
    return isSecureCookieEnv()
        ? `__Host-${HANDOFF_STATE_COOKIE_BASE_NAME}`
        : HANDOFF_STATE_COOKIE_BASE_NAME;
}

const KEY_PREFIX = 'auth:handoff:';
const TOKEN_RE = /^[0-9a-f]{64}$/;

export interface HandoffPayload {
    userId: string;
    next: string;
}

interface StoredHandoff extends HandoffPayload {
    state: string;
}

/**
 * The one way every handoff route turns an untrusted `next` into a same-site,
 * locale-aware ai path (start, issue, consume success).
 *
 * - sanitize → parse to a same-origin path → split off the locale → `localePath`,
 *   which can never emit `//` or `/\` (see its JSDoc for the round-trip hole).
 * - A `next` that is itself an `/api` path (e.g. another
 *   `/api/auth/handoff/start?next=…`) becomes the locale root: following it would
 *   chain handoffs and create one session per hop.
 */
export function resolveHandoffNext(raw: string | null | undefined): {
    locale: Locale;
    next: string;
} {
    const { locale, path } = splitLocalePath(
        toSameOriginPath(sanitizeNextPath(raw))
    );
    const localized = localePath(locale, path);
    return {
        locale,
        next: isApiPath(localized) ? localePath(locale, '/') : localized,
    };
}

/** 32 random bytes as hex — used for both the code and the state. */
export function generateHandoffToken(): string {
    return randomBytes(32).toString('hex');
}

export function isHandoffToken(
    value: string | null | undefined
): value is string {
    return typeof value === 'string' && TOKEN_RE.test(value);
}

/**
 * The ai-host state cookie. `ResponseCookie` has no `domain` field, so the cookie
 * is host-only by construction. `Path=/` is required by the `__Host-` prefix
 * (see `handoffStateCookieName`). An empty value yields an expired cookie (clear).
 */
export function handoffStateCookie(value: string): ResponseCookie {
    const maxAge = value === '' ? 0 : HANDOFF_STATE_TTL_SECONDS;
    return {
        name: handoffStateCookieName(),
        value,
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        expires: new Date(value === '' ? 0 : Date.now() + maxAge * 1000),
        maxAge,
    };
}

function parseStored(raw: unknown): StoredHandoff | null {
    let value = raw;
    // Upstash auto-deserializes stored JSON, so `raw` is usually already an object
    // (same handling as pendingOAuthSignupStore). A string means it was not JSON.
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Record<string, unknown>;
    return typeof candidate.userId === 'string' &&
        typeof candidate.next === 'string' &&
        typeof candidate.state === 'string'
        ? {
              userId: candidate.userId,
              next: candidate.next,
              state: candidate.state,
          }
        : null;
}

/**
 * Issues a one-time SSO code (spec §8, §9-4) bound to the requesting browser's
 * `state` (see `/api/auth/handoff/start` for why). Throws when Redis is not
 * configured or the write is not acknowledged — the issue route degrades to
 * `?sso=none`.
 */
export async function issueHandoffCode(
    input: HandoffPayload & { state: string }
): Promise<string> {
    const redis = getRedisClient();
    if (redis === null) throw new Error('[handoff] redis unavailable');
    const code = generateHandoffToken();
    const stored: StoredHandoff = {
        userId: input.userId,
        next: sanitizeNextPath(input.next),
        state: input.state,
    };
    const ok = await redis.set(`${KEY_PREFIX}${code}`, JSON.stringify(stored), {
        ex: HANDOFF_TTL_SECONDS,
    });
    if (ok !== 'OK') throw new Error('[handoff] code not stored');
    return code;
}

/**
 * Consumes a code exactly once (`getdel`). Returns null for malformed input
 * (without touching Redis), unknown/expired/reused codes, corrupt payloads, and
 * a state that does not match the one stored at issue. A mismatch still burns
 * the code, so a planted code cannot be retried.
 */
export async function consumeHandoffCode(
    code: string | null | undefined,
    state: string | null | undefined
): Promise<HandoffPayload | null> {
    if (!isHandoffToken(code) || !isHandoffToken(state)) return null;
    const redis = getRedisClient();
    if (redis === null) return null;
    const stored = parseStored(await redis.getdel(`${KEY_PREFIX}${code}`));
    if (stored === null || !isHandoffToken(stored.state)) return null;
    // Both sides are validated 64-char hex, so the buffers have equal length.
    if (!timingSafeEqual(Buffer.from(stored.state), Buffer.from(state)))
        return null;
    return { userId: stored.userId, next: sanitizeNextPath(stored.next) };
}
