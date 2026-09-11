import { localePath, splitLocalePath } from '@/shared/i18n/locales';

export const DEFAULT_REDIRECT_PATH = '/';

/** Post-signup holdings onboarding screen — see `resolvePostSignupDestination` below. */
export const POST_SIGNUP_ONBOARDING_PATH = '/onboarding';

const PATH_PREFIX = '/';
const PROTOCOL_RELATIVE_PREFIX = '//';
const BACKSLASH_HOST_PREFIX = '/\\';
/** 상대 경로를 파싱하기 위한 더미 base. 호스트는 결과에 쓰이지 않는다. */
const PARSE_ONLY_BASE = 'https://siglens.invalid';

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
    if (!resolvesToSafePath(input)) return DEFAULT_REDIRECT_PATH;
    return input;
}

/**
 * 문자열이 아니라 **파서가 해석한 결과**로 한 번 더 본다.
 *
 * 접두사 검사는 원문만 보므로 dot segment를 놓친다 — `"/.//evil.com"`,
 * `"/%2e//evil.com"`, `"/a/..//evil.com"`, `"/./\\evil.com"`은 `//`로 시작하지
 * 않아 통과하지만 `new URL()`이 dot segment를 접으면 경로가 `"//evil.com"`이
 * 되고, 그 값으로 만든 리다이렉트는 `https://evil.com`으로 나간다.
 *
 * `startsWith('//')`가 아니라 `includes('//')`인 이유: `localeHref`/`useLocalePath`는
 * 로케일 접두사를 **문자열로** 벗긴 뒤 다시 붙인다. `"/en//evil.com"`은 파싱해도
 * 같은-오리진이지만, 요청 로케일이 ko면 접두사가 벗겨져 `"//evil.com"`이 된다
 * (`LoginContent`가 `/en/en//evil.com`을 한 번 벗겨 hidden 필드에 `/en//evil.com`을
 * 싣고, `loginAction`의 `localeHref`가 한 번 더 벗긴다).
 * 정상 경로에는 빈 세그먼트가 없으므로 경로 어디에든 `//`가 있으면 거절한다.
 * 쿼리(`?next=%2Fc%2Fabc`)는 검사 대상이 아니다.
 */
function resolvesToSafePath(input: string): boolean {
    try {
        const url = new URL(input, PARSE_ONLY_BASE);
        return (
            url.origin === PARSE_ONLY_BASE &&
            !url.pathname.includes(PROTOCOL_RELATIVE_PREFIX)
        );
    } catch {
        return false;
    }
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
 * 파싱 결과의 origin이 base와 다르면(절대 URL·프로토콜-상대 URL) 경로만 떼어
 * 살리지 않고 기본 경로로 떨어뜨린다. 정상 호출자는 항상 `sanitizeNextPath`를
 * 먼저 거치므로 그런 값이 여기까지 올 이유가 없다.
 */
export function toSameOriginPath(next: string): string {
    try {
        const url = new URL(next, PARSE_ONLY_BASE);
        if (url.origin !== PARSE_ONLY_BASE) return DEFAULT_REDIRECT_PATH;
        // 정규화된 결과를 다시 검사한다 — 파싱이 dot segment를 접어 `//evil.com`을
        // 만들 수 있으므로, 호출 순서와 무관하게 이 함수의 출력만으로 안전해야 한다.
        return sanitizeNextPath(`${url.pathname}${url.search}${url.hash}`);
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
