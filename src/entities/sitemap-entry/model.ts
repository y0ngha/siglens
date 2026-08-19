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
    /**
     * 이 URL의 다국어 대체본. `hreflang → 절대 URL`.
     *
     * 로케일마다 `<url>` 엔트리를 따로 만들지 않고 **하나의 엔트리에
     * `xhtml:link`를 붙인다** — Google이 권장하는 다국어 sitemap 형식이고,
     * 파일 크기가 로케일 수만큼 곱해지지 않는다(종목 URL만 2,900여 개다).
     *
     * ⚠️ **색인 게이트를 통과하지 못한 로케일은 넣지 않는다.** sitemap이
     * noindex URL을 광고하면 크롤 예산만 태운다(ETF `/financials`를 빼는 것과
     * 같은 원칙). 비어 있거나 생략되면 `xhtml` 네임스페이스 선언도 나가지 않는다.
     */
    alternates?: Readonly<Record<string, string>>;
}

/** sitemap index 안의 <sitemap> 항목. lastmod는 옵션이지만 권장. */
export interface SitemapIndexEntry {
    url: string;
    lastModified: Date;
}

export const REMOVAL_SITEMAP_KINDS = [
    'chart',
    'news',
    'overall',
    'fundamental',
    'fear-greed',
] as const;

export type RemovalSitemapKind = (typeof REMOVAL_SITEMAP_KINDS)[number];

export interface RemovalSitemapEntry {
    url: string;
    lastModified: Date;
}

export interface RemovalSitemapCandidateSource {
    loadStockSymbolsBefore(
        cutoff: Date,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]>;
    loadHistoricalCryptoSymbols(
        limit: number,
        excludedSymbols: readonly string[]
    ): Promise<readonly string[]>;
}

export const REMOVAL_CHART_CUTOFF_ISO = '2026-07-07T16:25:18.000Z';
export const REMOVAL_LEGACY_TAB_CUTOFF_ISO = '2026-06-15T08:36:58.000Z';
export const REMOVAL_LAST_MODIFIED_ISO = '2026-07-08T00:00:00.000Z';
export const REMOVAL_CRYPTO_LIMIT = 1_000;

export function isRemovalSitemapKind(
    value: string
): value is RemovalSitemapKind {
    return REMOVAL_SITEMAP_KINDS.some(kind => kind === value);
}

/**
 * 한 sub-sitemap 파일에 넣을 수 있는 URL 상한. sitemap.org 표준은 50,000이지만
 * 그 한계까지 채우면 단일 실패 비용이 커지고, lastmod 갱신 신호도 무뎌진다.
 * route handler는 엔트리 생성 이후 이 상한을 초과하지 않는지 검증해야 한다.
 */
export const SITEMAP_MAX_URLS_PER_FILE = 50_000;
