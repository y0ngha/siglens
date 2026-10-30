import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '@/shared/cache/redisClient';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/shared/i18n/locales';
import { sanitizeNextPath } from '@/shared/lib/auth/redirect';
import { isSecureCookieEnv } from '../lib/sessionCookieOptions';
import type { ResponseCookie } from '../lib/types';

/** 1회용 코드 수명. 코드는 302 한 홉만 살아남으면 된다. */
const HANDOFF_TTL_SECONDS = 60;

/**
 * ai 호스트 SSO state 쿠키 수명. start → (메인 호스트) issue → consume 모두 자동
 * 리다이렉트로 이어지므로 OAuth state의 5분 창이면 충분하다.
 */
export const HANDOFF_STATE_TTL_SECONDS = 5 * 60;

const HANDOFF_STATE_COOKIE_BASE_NAME = 'siglens_ai_sso_state';

/**
 * ai 호스트에서 `/api/auth/handoff/start`가 심고 `/api/auth/handoff/consume`이 읽는
 * 브라우저 바인딩 쿠키의 이름.
 *
 * 프로덕션은 쿠키 토싱을 막으려고 `__Host-` 접두를 쓴다. 없으면 형제 서브도메인
 * (`siglens.io` 아래 아무 곳)이 `Domain=siglens.io`로 `siglens_ai_sso_state`를 심을
 * 수 있고, ai 호스트도 그걸 받아 공격자 계정용으로 발급된 코드에 피해자 브라우저를
 * 묶을 수 있다. 브라우저는 `Secure`·`Path=/`·`Domain` 없음인 `__Host-` 쿠키만
 * 받으므로 다른 호스트는 이 쿠키를 심을 수 없다.
 *
 * 비보안 환경(http 개발·e2e)은 `Secure` 없이 `__Host-`가 거부되므로 접두 없는 이름을
 * 쓴다. 양쪽 모두 이 함수를 써야 한다 — 하드코딩 이름을 읽으면 다른 이름의 쿠키는
 * 무시된다.
 */
export function handoffStateCookieName(): string {
    return isSecureCookieEnv()
        ? `__Host-${HANDOFF_STATE_COOKIE_BASE_NAME}`
        : HANDOFF_STATE_COOKIE_BASE_NAME;
}

const KEY_PREFIX = 'auth:handoff:';
const LOGOUT_KEY_PREFIX = 'auth:handoff-logout:';
const TOKEN_RE = /^[0-9a-f]{64}$/;

/** consume가 돌려주는, 핸드오프 코드에 묶여 있던 사용자와 복귀 경로. */
export interface HandoffPayload {
    userId: string;
    next: string;
}

interface StoredHandoff extends HandoffPayload {
    state: string;
}

/** ai 호스트 로그아웃이 메인 호스트에 넘기는 값: 누구의 세션을 끝낼지, 돌아올 로케일. */
export interface LogoutCodePayload {
    userId: string;
    locale: Locale;
}

/** 코드·state 양쪽에 쓰는 32바이트 난수 hex. 64자 hex라 {@link isHandoffToken}을 통과한다. */
export function generateHandoffToken(): string {
    return randomBytes(32).toString('hex');
}

/** 코드·state가 `generateHandoffToken` 형태(64자 소문자 hex)인지 검사한다. Redis를 건드리기 전 입력 게이트다. */
export function isHandoffToken(
    value: string | null | undefined
): value is string {
    return typeof value === 'string' && TOKEN_RE.test(value);
}

/**
 * ai 호스트 state 쿠키. `ResponseCookie`에는 `domain` 필드가 없어 구조적으로 host-only
 * 쿠키가 된다. `__Host-` 접두가 `Path=/`를 요구한다({@link handoffStateCookieName}).
 * 빈 값이면 만료 쿠키(삭제)를 돌려준다.
 */
export function handoffStateCookie(value: string): ResponseCookie {
    const isClear = value === '';
    const maxAge = isClear ? 0 : HANDOFF_STATE_TTL_SECONDS;
    return {
        name: handoffStateCookieName(),
        value,
        httpOnly: true,
        secure: isSecureCookieEnv(),
        sameSite: 'lax',
        path: '/',
        expires: new Date(isClear ? 0 : Date.now() + maxAge * 1000),
        maxAge,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * Upstash는 저장된 JSON을 자동 역직렬화하므로 `raw`는 보통 이미 객체다
 * (pendingOAuthSignupStore와 같은 처리). 문자열이면 JSON이 아니었다는 뜻이라 파싱을 시도한다.
 */
function parseStoredRecord(raw: unknown): Record<string, unknown> | null {
    if (typeof raw !== 'string') return isRecord(raw) ? raw : null;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function parseStoredHandoff(raw: unknown): StoredHandoff | null {
    const candidate = parseStoredRecord(raw);
    if (candidate === null) return null;
    const { userId, next, state } = candidate;
    return typeof userId === 'string' &&
        typeof next === 'string' &&
        typeof state === 'string'
        ? { userId, next, state }
        : null;
}

/**
 * 요청한 브라우저의 `state`에 묶인 1회용 SSO 코드를 발급한다(이유는
 * `/api/auth/handoff/start` 참고). Redis가 설정되지 않았거나 쓰기가 확인되지
 * 않으면 던지고, 발급 라우트는 `?sso=none`으로 강등한다.
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
 * 코드를 정확히 한 번 소비한다(`getdel`). 형식이 틀린 입력(Redis 접근 없음), 모르는·만료된·
 * 재사용된 코드, 깨진 페이로드, 발급 시 저장된 state와 다른 state면 null이다. state가
 * 달라도 코드는 소각되어 심어진 코드를 재시도할 수 없다.
 */
export async function consumeHandoffCode(
    code: string | null | undefined,
    state: string | null | undefined
): Promise<HandoffPayload | null> {
    if (!isHandoffToken(code) || !isHandoffToken(state)) return null;
    const redis = getRedisClient();
    if (redis === null) return null;
    const stored = parseStoredHandoff(
        await redis.getdel(`${KEY_PREFIX}${code}`)
    );
    if (stored === null || !isHandoffToken(stored.state)) return null;
    // 양쪽 모두 64자 hex로 검증됐으므로 버퍼 길이가 같다.
    if (!timingSafeEqual(Buffer.from(stored.state), Buffer.from(state))) {
        return null;
    }
    return { userId: stored.userId, next: sanitizeNextPath(stored.next) };
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

/** 로그아웃 코드를 정확히 한 번 소비한다(`getdel`). 형식이 틀리거나 모르는·만료된·깨진 코드면 null. */
export async function consumeLogoutCode(
    code: string | null | undefined
): Promise<LogoutCodePayload | null> {
    if (!isHandoffToken(code)) return null;
    const redis = getRedisClient();
    if (redis === null) return null;
    const candidate = parseStoredRecord(
        await redis.getdel(`${LOGOUT_KEY_PREFIX}${code}`)
    );
    if (candidate === null) return null;
    const { userId, locale } = candidate;
    if (typeof userId !== 'string') return null;
    return {
        userId,
        locale:
            typeof locale === 'string' && isLocale(locale)
                ? locale
                : DEFAULT_LOCALE,
    };
}
