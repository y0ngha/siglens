import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import {
    DEFAULT_LOCALE,
    isApiPath,
    isLocale,
    localePath,
    splitLocalePath,
    type Locale,
} from '@/shared/i18n/locales';
import {
    PARSE_ONLY_BASE,
    sanitizeNextPath,
    toSameOriginPath,
} from '@/shared/lib/auth/redirect';
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

/**
 * The ai-host first hop of the handoff (`/api/auth/handoff/start?next=…`) for an
 * untrusted ai `next`. The origin is always the `AI_SITE_URL` constant.
 */
export function handoffStartUrl(raw: string | null | undefined): URL {
    const { locale, next } = resolveHandoffNext(raw);
    const start = new URL(
        localePath(locale, '/api/auth/handoff/start'),
        AI_SITE_URL
    );
    start.searchParams.set('next', next);
    return start;
}

const HANDOFF_ISSUE_PATH = '/api/auth/handoff';

/**
 * Server Action이 로그인/가입 직후 `redirect()`할 대상을 고른다. 대상이 SSO
 * 핸드오프 발급 경로(`/api/auth/handoff?to=ai&next=…`)면 그 라우트가 state 없는
 * 요청에 돌려줄 ai 호스트 start URL(절대 URL)로 바꾸고, 아니면 그대로 돌려준다.
 *
 * 왜 필요한가 — Server Action의 **같은-호스트** `redirect()`는 브라우저 이동이
 * 아니다. Next.js가 서버 안에서 그 URL을 `RSC: 1` 헤더와 방금 심은 세션 쿠키를
 * 실어 fetch하고(302를 따라감), 받은 Flight 응답을 클라이언트 라우터가 SPA로
 * 적용한다. 핸드오프 라우트는 ai 호스트로 302 체인(start → issue → consume)을
 * 타므로 그 체인이 **서버 fetch 안에서** 소진된다 — ai 호스트의 state 쿠키는
 * 브라우저에 심기지 않고, 끝에 도착한 ai 페이지(`?sso=none`)의 RSC가 메인
 * 호스트 URL에 적용된다. 결과: 이메일 로그인은 성공하지만 ai.siglens.io로
 * 돌아가지 않는다. (OAuth는 콜백이 Route Handler라 진짜 302로 이동해서 멀쩡했다.)
 *
 * 다른 호스트의 절대 URL은 Next.js가 외부 리다이렉트로 취급해 서버 fetch 없이
 * 클라이언트가 `location.assign`으로 하드 내비게이션한다. start부터 시작하면
 * 발급 라우트가 어차피 하던 바운스(`handoff/route.ts`)를 한 홉 앞당길 뿐이다.
 */
export function toHandoffAwareRedirect(target: string): string {
    const url = new URL(target, PARSE_ONLY_BASE);
    if (
        url.origin !== PARSE_ONLY_BASE ||
        url.pathname !== HANDOFF_ISSUE_PATH ||
        url.searchParams.get('to') !== 'ai'
    )
        return target;
    return handoffStartUrl(url.searchParams.get('next')).href;
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

const LOGOUT_KEY_PREFIX = 'auth:handoff-logout:';

/** What an ai-host logout hands to the main host: whose session to end, and the locale to land back in. */
export interface LogoutCodePayload {
    userId: string;
    locale: Locale;
}

/** A signed-out ai visitor's landing (`?sso=none` stops the handoff from signing them back in). */
export function aiSignedOutUrl(locale: Locale): URL {
    const url = new URL(localePath(locale, '/'), AI_SITE_URL);
    url.searchParams.set('sso', 'none');
    return url;
}

/**
 * ai 호스트 로그아웃을 메인 호스트까지 전파하는 1회용 코드를 발급한다.
 *
 * 왜 필요한가 — 두 호스트의 세션 쿠키는 각자 host-only라 ai에서 메인 세션을
 * 지울 수 없다. ai 세션만 지우면 ai 홈이 세션 없음을 보고 핸드오프를 다시
 * 돌려 **살아 있는 메인 세션으로 곧바로 재로그인**한다. 그래서 ai 로그아웃은
 * 이 코드를 들고 메인 `/api/auth/handoff/logout`으로 넘어가 메인 세션도 끝낸다.
 *
 * 왜 코드인가(로그아웃 CSRF) — 코드 없이 GET 한 번으로 메인 세션을 끊을 수
 * 있으면 아무 페이지나 피해자를 로그아웃시킨다. 코드는 ai 세션 소유자만
 * 발급할 수 있고, 소비 측은 코드의 userId가 **현재 메인 세션의 사용자와 같을
 * 때만** 세션을 지운다 — 공격자가 자기 계정으로 발급한 코드를 심어도 무해하다.
 */
export async function issueLogoutCode(
    input: LogoutCodePayload
): Promise<string> {
    const redis = getRedisClient();
    if (redis === null) throw new Error('[handoff] redis unavailable');
    const code = generateHandoffToken();
    const ok = await redis.set(
        `${LOGOUT_KEY_PREFIX}${code}`,
        JSON.stringify({ userId: input.userId, locale: input.locale }),
        { ex: HANDOFF_TTL_SECONDS }
    );
    if (ok !== 'OK') throw new Error('[handoff] logout code not stored');
    return code;
}

/** Consumes a logout code exactly once (`getdel`). Null for malformed/unknown/expired/corrupt. */
export async function consumeLogoutCode(
    code: string | null | undefined
): Promise<LogoutCodePayload | null> {
    if (!isHandoffToken(code)) return null;
    const redis = getRedisClient();
    if (redis === null) return null;
    let value: unknown = await redis.getdel(`${LOGOUT_KEY_PREFIX}${code}`);
    // Upstash auto-deserializes stored JSON (see parseStored).
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (typeof value !== 'object' || value === null) return null;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.userId !== 'string') return null;
    const locale =
        typeof candidate.locale === 'string' && isLocale(candidate.locale)
            ? candidate.locale
            : DEFAULT_LOCALE;
    return { userId: candidate.userId, locale };
}
