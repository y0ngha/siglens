import { localePath, splitLocalePath } from '@/shared/i18n/locales';

export const DEFAULT_REDIRECT_PATH = '/';

/** Post-signup holdings onboarding screen — see `resolvePostSignupDestination` below. */
export const POST_SIGNUP_ONBOARDING_PATH = '/onboarding';

const PATH_PREFIX = '/';
const PROTOCOL_RELATIVE_PREFIX = '//';
const BACKSLASH_HOST_PREFIX = '/\\';

// Open-redirect 방어: 같은 origin의 path-only만 허용, 그 외 '/' 반환
export function sanitizeNextPath(input: string | null | undefined): string {
    if (!input) return DEFAULT_REDIRECT_PATH;
    if (!input.startsWith(PATH_PREFIX)) return DEFAULT_REDIRECT_PATH;
    if (
        input.startsWith(PROTOCOL_RELATIVE_PREFIX) ||
        input.startsWith(BACKSLASH_HOST_PREFIX)
    )
        return DEFAULT_REDIRECT_PATH;
    return input;
}

/**
 * Post-signup routing policy: a brand-new member with no specific return target
 * lands on the holdings onboarding screen; a member who signed up from a specific
 * page (e.g. /AAPL) returns there instead. Callers pass an already-sanitized next.
 *
 * ⚠️ **로케일 접두사를 벗기고 비교한다.** 비-ko 사용자의 "돌아갈 곳 없음"은 `/`가
 * 아니라 `/en`·`/ja`·`/zh`다. 문자열 그대로 비교하면 en/ja/zh 신규 회원이
 * 온보딩 대신 홈으로 떨어져 **지원 로케일 4개 중 3개에서 온보딩 정책이 죽는다.**
 * 반환값도 같은 로케일로 다시 붙인다 — 온보딩 화면만 한국어가 되면 안 된다.
 */
export function resolvePostSignupDestination(next: string): string {
    const { locale, path } = splitLocalePath(next);
    return path === DEFAULT_REDIRECT_PATH
        ? localePath(locale, POST_SIGNUP_ONBOARDING_PATH)
        : next;
}
