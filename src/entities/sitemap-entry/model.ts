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

export interface LongTailTickerSource {
    count(): Promise<number>;
    /** pageNumber는 1부터 시작한다. */
    loadPage(pageNumber: number, pageSize: number): Promise<readonly string[]>;
}

/**
 * 한 sub-sitemap 파일에 넣을 수 있는 URL 상한. sitemap.org 표준은 50,000이지만
 * 그 한계까지 채우면 단일 실패 비용이 커지고, lastmod 갱신 신호도 무뎌진다.
 * route handler는 엔트리 생성 이후 이 상한을 초과하지 않는지 검증해야 한다.
 */
export const SITEMAP_MAX_URLS_PER_FILE = 50_000;

// 롱테일 종목은 메인 차트 라우트(/TICKER) 1개만 sitemap에 광고한다.
// 서브 라우트(overall/fundamental/news/fear-greed)는 thin/scaled-content 리스크와
// 봇 first-gen ISR write 비용을 줄이기 위해 미광고(페이지는 on-demand로 존재·내부 링크로 도달).
// LONGTAIL_TICKERS_PER_PAGE에서 역산하지 않는다(독립 상수).
export const LONGTAIL_ENTRIES_PER_TICKER = 1;

/**
 * long-tail 페이지네이션의 안정적인 티커 경계.
 * URL 상한은 엔트리 생성 이후 별도로 검증하므로,
 * LONGTAIL_ENTRIES_PER_TICKER에서 역산하지 않는다.
 */
export const LONGTAIL_TICKERS_PER_PAGE = 2_000;
