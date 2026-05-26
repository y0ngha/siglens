// sitemap.org 표준 changefreq 값. SitemapEntry.changeFrequency를 string으로
// 두면 잘못된 값이 silently invalid XML로 들어가는 회귀 위험이 있어 literal
// union으로 좁힌다.
export type SitemapChangeFrequency =
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';

export interface SitemapEntry {
    url: string;
    lastModified: Date;
    changeFrequency: SitemapChangeFrequency;
    priority: number;
}

/** sitemap index 안의 <sitemap> 항목. lastmod는 옵션이지만 권장. */
export interface SitemapIndexEntry {
    url: string;
    lastModified: Date;
}

/**
 * 한 sub-sitemap 파일에 넣을 수 있는 URL 상한. sitemap.org 표준은 50,000이지만
 * 그 한계까지 채우면 단일 실패 비용이 커지고, lastmod 갱신 신호도 무뎌진다.
 * 50,000으로 잡되, 운영 중 cap에 도달하면 추후 더 작은 chunk로 분할 검토.
 */
export const SITEMAP_MAX_URLS_PER_FILE = 50_000;

/**
 * long-tail 티커당 sitemap 엔트리 수.
 * chart + news + fundamental + overall + fear-greed = 5.
 * sitemap index 페이지네이션과 longtail route handler 양쪽에서 참조한다.
 */
export const LONGTAIL_ENTRIES_PER_TICKER = 5;

/**
 * 한 sitemap 파일에 담을 수 있는 long-tail 티커 수.
 * 티커당 LONGTAIL_ENTRIES_PER_TICKER개 URL을 생성하므로,
 * SITEMAP_MAX_URLS_PER_FILE을 넘지 않도록 역산한다.
 */
export const LONGTAIL_TICKERS_PER_PAGE = Math.floor(
    SITEMAP_MAX_URLS_PER_FILE / LONGTAIL_ENTRIES_PER_TICKER
);
