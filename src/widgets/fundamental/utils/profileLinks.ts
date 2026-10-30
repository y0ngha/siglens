/**
 * 기업 프로필의 웹사이트·CEO 값 정규화 — 공급자 문자열을 그대로 `href`·본문에 넣지 않는다.
 */

/** 렌더 가능한 외부 링크. */
export interface ProfileLink {
    href: string;
    /** 스킴을 뗀 표시 텍스트. */
    label: string;
}

/** `javascript:`·`mailto:` 같은 스킴. `host:8080`의 포트는 스킴이 아니다(콜론 뒤 숫자). */
const SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:(?!\d)/i;
const HTTP_SCHEME_PREFIX = /^https?:\/\//i;

/**
 * 웹사이트 문자열을 안전한 http(s) 링크로 만든다. 비었거나 http(s)가 아니거나 파싱이
 * 안 되면 `null`(행을 숨긴다). 스킴이 없으면 `https://`를 붙인다.
 */
export function normalizeWebsite(raw: string | null): ProfileLink | null {
    const trimmed = raw?.trim() ?? '';
    if (trimmed === '') return null;

    const href = SCHEME_PREFIX.test(trimmed)
        ? trimmed
        : `https://${trimmed.replace(/^\/\//, '')}`;

    try {
        const { protocol } = new URL(href);
        if (protocol !== 'http:' && protocol !== 'https:') return null;
    } catch {
        return null;
    }
    return { href, label: href.replace(HTTP_SCHEME_PREFIX, '') };
}

/** CEO 이름을 다듬는다. 공백뿐이거나 비면 `null`(행을 숨긴다). */
export function normalizeCeo(raw: string | null): string | null {
    return raw?.trim() || null;
}
