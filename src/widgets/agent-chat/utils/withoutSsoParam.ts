const SSO_PARAM = 'sso';

/** `sso=none` / `sso` 같은 한 조각이 `sso` 파라미터인가(이름만 본다). */
function isSsoPair(pair: string): boolean {
    const name = pair.split('=', 1)[0] ?? '';
    return name === SSO_PARAM;
}

/**
 * 주소(`pathname + search + hash`)에서 **`sso` 쿼리 파라미터만** 지운 값. `sso`가
 * 없으면 `null`이다(주소창을 건드릴 필요가 없다는 뜻).
 *
 * SSO 핸드오프가 실패해 돌아온 방문(`/?sso=none`)의 `sso`는 서버가 재시도를 건너뛰는
 * 신호일 뿐 사용자가 볼 이유가 없다 — 그대로 두면 새로고침·공유·북마크에 실려 나간다.
 * 다른 파라미터는 그대로 둔다: `q`(질문 진입 링크)·`gclid`/`utm_*`(광고 식별자)를
 * 지우면 질문이 날아가거나 방문이 광고와 끊긴다. 해시도 보존한다.
 *
 * `URLSearchParams`로 다시 직렬화하지 않고 원문 조각을 걸러낸다 — 직렬화는 남은
 * 파라미터의 인코딩(`%20` → `+` 등)까지 바꾸므로, 광고 식별자가 원문 그대로
 * 남는다는 보장이 사라진다.
 */
export function withoutSsoParam(href: string): string | null {
    const url = new URL(href, 'http://placeholder.invalid');
    const pairs = url.search.slice(1).split('&').filter(Boolean);
    if (!pairs.some(isSsoPair)) return null;
    const rest = pairs.filter(pair => !isSsoPair(pair));
    return `${url.pathname}${rest.length > 0 ? `?${rest.join('&')}` : ''}${url.hash}`;
}
