import type { SitemapEntry } from '../model';

/**
 * 엔트리 집합에서 가장 최근 `lastModified`를 고른다. sitemap index의 자식 lastmod가
 * "그 sitemap 안에서 가장 최근에 바뀐 페이지" 시점이 되도록 하는 용도다.
 *
 * `lastModified`가 없는 엔트리(`/symbols`처럼 lastmod를 생략한 URL)는 **건너뛴다** —
 * 광고할 시각이 없는 URL이 index lastmod를 끌어올리거나 끌어내리면 안 된다.
 *
 * `fallback`은 시각을 가진 엔트리가 하나도 없을 때만 쓰인다(현재 모든 빌더가 비지
 * 않지만, 설정 목록이 비는 경우를 대비해 Invalid Date를 내보내지 않도록 방어). 빈
 * 여부는 개수로만 판정한다 — 누적값 0을 "없음"의 센티널로 쓰면 lastModified가
 * 정확히 Unix epoch인 유효한 엔트리를 없는 것으로 취급하게 된다.
 *
 * 두 분기 모두 **새 Date를 만들어** 돌려준다. 호출자가 반환값을 mutate해도 입력
 * 엔트리나 `fallback`이 따라 바뀌지 않아야 한다.
 *
 * `Math.max(...)` 스프레드를 쓰지 않는 이유: sitemap 한 파일은
 * `SITEMAP_MAX_URLS_PER_FILE`까지 커질 수 있고, 그만큼의 인자를 펼치면 호출 스택
 * 한계에 닿는다. `reduce`는 같은 O(N)이면서 그 제약이 없다.
 */
export function maxLastModified(
    entries: ReadonlyArray<SitemapEntry>,
    fallback: Date
): Date {
    const times = entries.flatMap(({ lastModified }) =>
        lastModified === undefined ? [] : [lastModified.getTime()]
    );
    if (times.length === 0) return new Date(fallback.getTime());

    return new Date(
        times.reduce((max, time) => Math.max(max, time), -Infinity)
    );
}
