import { localePath, splitLocalePath } from '@/shared/i18n/locales';

export const DEFAULT_REDIRECT_PATH = '/';

/** Post-signup holdings onboarding screen — see `resolvePostSignupDestination` below. */
export const POST_SIGNUP_ONBOARDING_PATH = '/onboarding';

const PATH_PREFIX = '/';
const PROTOCOL_RELATIVE_PREFIX = '//';
const BACKSLASH_HOST_PREFIX = '/\\';

/**
 * C0 제어문자와 공백. **접두사 검사보다 먼저** 걸러야 한다.
 *
 * WHATWG URL 파서는 파싱 전에 이 문자들을 제거하므로, 아래 접두사 검사만으로는
 * `"/\t/evil.com"`을 막을 수 없다 — `"/"`로 시작하고 `"//"`나 `"/\"`로 시작하지
 * 않으니 그대로 통과한 뒤, `new URL()`이 탭을 지우고 `"//evil.com"`으로 다시
 * 읽어 **off-origin으로 해석한다**. 실측:
 *
 *   sanitize("/\t/evil.com") = "/\t/evil.com"
 *   new URL(그 값, "https://siglens.io") = "https://evil.com/"
 *
 * `\n`·`\r`도 같다. 명명된 세 형태(`//`, `/\`, 절대 URL)는 원래 막혔고 공백만
 * 빠져나갔다.
 */
/** 정규식이 아니라 코드포인트로 본다 — `no-control-regex`를 억제하지 않기 위해서다. */
const MAX_STRIPPED_CODE_POINT = 0x20;

function hasUrlStrippedChar(input: string): boolean {
    for (let i = 0; i < input.length; i += 1) {
        if (input.charCodeAt(i) <= MAX_STRIPPED_CODE_POINT) return true;
    }
    return false;
}

// Open-redirect 방어: 같은 origin의 path-only만 허용, 그 외 '/' 반환
export function sanitizeNextPath(input: string | null | undefined): string {
    if (!input) return DEFAULT_REDIRECT_PATH;
    if (hasUrlStrippedChar(input)) return DEFAULT_REDIRECT_PATH;
    if (!input.startsWith(PATH_PREFIX)) return DEFAULT_REDIRECT_PATH;
    if (
        input.startsWith(PROTOCOL_RELATIVE_PREFIX) ||
        input.startsWith(BACKSLASH_HOST_PREFIX)
    )
        return DEFAULT_REDIRECT_PATH;
    return input;
}

/**
 * 리디렉트 대상에서 **경로 부분만** 남긴다. 문자열 검사를 통과한 값이 host를
 * 품고 있어도 origin이 바뀔 수 없게 하는 2차 방어다.
 *
 * 왜 헬퍼로 묶는가: 이 세 줄이 `loginAction`·`registerAction`·
 * `finalizeOAuthSignupAction` 세 곳에 같은 주석과 함께 복사돼 있었고,
 * **OAuth 콜백 라우트 하나만 빠져 있었다.** 그 한 곳이 정확히 뚫린 자리였다 —
 * `NextResponse.redirect(new URL(sanitizeNextPath(next), base))`는 파싱 결과를
 * 그대로 넘기므로 `"/\t/evil.com"`이 `https://evil.com/`으로 나갔다. 복사본이
 * 늘수록 빠뜨린 한 곳이 생기므로 호출 지점을 하나로 모은다.
 *
 * base 호스트는 결과에 쓰이지 않는 더미다 — 상대 경로를 파싱하기 위한 자리일 뿐이다.
 */
const PARSE_ONLY_BASE = 'https://siglens.invalid';

export function toSameOriginPath(next: string): string {
    try {
        const url = new URL(next, PARSE_ONLY_BASE);
        return `${url.pathname}${url.search}${url.hash}`;
    } catch {
        return DEFAULT_REDIRECT_PATH;
    }
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
