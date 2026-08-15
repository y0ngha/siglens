import type { SitemapEntry } from '../model';

/**
 * 엔트리 집합에서 가장 최근 `lastModified`를 고른다. sitemap index의 자식 lastmod가
 * "그 sitemap 안에서 가장 최근에 바뀐 페이지" 시점이 되도록 하는 용도다.
 *
 * `fallback`은 엔트리가 비었을 때만 쓰인다(현재 모든 빌더가 비지 않지만, 설정
 * 목록이 비는 경우를 대비해 Invalid Date를 내보내지 않도록 방어).
 */
export function maxLastModified(
    entries: ReadonlyArray<SitemapEntry>,
    fallback: Date
): Date {
    let max = 0;
    for (const { lastModified } of entries) {
        const t = lastModified.getTime();
        if (t > max) max = t;
    }
    return max === 0 ? fallback : new Date(max);
}
