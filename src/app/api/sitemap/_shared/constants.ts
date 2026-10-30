/** sitemap 데이터를 못 읽었을 때 `Retry-After`(초) — 크롤러가 다시 오기까지의 간격. */
export const SITEMAP_RETRY_AFTER_SECONDS = '300';
/** sitemap 데이터를 못 읽었을 때의 503 본문(RSS 피드도 같은 응답을 쓴다). */
export const SITEMAP_UNAVAILABLE_BODY = 'Sitemap data temporarily unavailable';
/** sitemap·RSS 공개 캐시 헤더 — 1시간 신선 + 1시간 stale 허용. 응답 계약이라 값을 바꾸지 않는다. */
export const SITEMAP_CACHE_CONTROL =
    'public, max-age=3600, stale-while-revalidate=3600';
