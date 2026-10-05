/**
 * URL에서 `utm_*` 추적 파라미터만 걷어낸다.
 *
 * 외부 매체 기사 URL을 구조화데이터 `url`로 싣기 전에 쓴다 — 추적 파라미터가 붙은 주소는
 * 같은 기사가 URL마다 다른 개체로 보이고, 우리가 보낸 적 없는 캠페인 값을 마크업이 주장하게
 * 된다.
 *
 * **원문 문자열을 직접 다룬다.** `URL`/`URLSearchParams`로 다시 직렬화하면 건드리지 않은
 * 파라미터까지 인코딩이 바뀐다(`%20`→`+`, `~`→`%7E`, 호스트만 있는 주소에 `/` 추가). 그래서
 * `utm_*`가 하나도 없으면 입력을 **그대로** 돌려주고, 있으면 그 `키=값` 조각만 쿼리 문자열에서
 * 잘라내며 나머지는 한 글자도 바꾸지 않는다. 남는 쿼리가 없으면 `?`도 걷어내고, 해시는 둔다.
 */
export function stripUtmParams(url: string): string {
    const hashAt = url.indexOf('#');
    const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
    const hash = hashAt === -1 ? '' : url.slice(hashAt);

    const queryAt = beforeHash.indexOf('?');
    if (queryAt === -1) return url;

    const base = beforeHash.slice(0, queryAt);
    const pairs = beforeHash.slice(queryAt + 1).split('&');
    const kept = pairs.filter(
        pair => !(pair.split('=')[0] ?? '').toLowerCase().startsWith('utm_')
    );
    if (kept.length === pairs.length) return url;

    const query = kept.filter(pair => pair !== '').join('&');
    return `${base}${query === '' ? '' : `?${query}`}${hash}`;
}
