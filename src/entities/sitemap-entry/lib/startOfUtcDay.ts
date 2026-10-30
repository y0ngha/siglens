/**
 * `now`가 속한 UTC 날짜의 자정. 하루에 한 번만 바뀌는 lastmod의 기준값이다 —
 * 정적 sitemap(`/economy*` 등)과 크립토 sitemap(UTC 일봉 마감)이 같은 정의를 쓴다.
 */
export function startOfUtcDay(now: Date): Date {
    return new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
}
