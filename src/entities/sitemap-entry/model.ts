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
 * route handler는 엔트리 생성 이후 이 상한을 초과하지 않는지 검증해야 한다.
 */
export const SITEMAP_MAX_URLS_PER_FILE = 50_000;
