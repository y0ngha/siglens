import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

export const LONGTAIL_CHART_PRIORITY = 0.5;

/**
 * long-tail 티커의 sitemap 엔트리를 생성한다.
 *
 * 메인 차트 라우트(/TICKER) 1개만 광고한다 — 모든 종목이 검색 색인되도록 discoverability는
 * 보존하되, 서브 라우트(overall/fundamental/news/fear-greed)는 미광고해 봇 first-gen ISR write
 * 비용과 thin/scaled-content 색인 리스크를 줄인다. 서브 라우트는 on-demand ISR로 계속 존재하고
 * 내부 링크(CrossLinkCards)로 도달 가능하다. popular 종목은 buildPopularEntries가 풀 라우트로 다룬다.
 * 옵션 라우트는 포함하지 않으며, priority는 LONGTAIL_CHART_PRIORITY(0.5), lastmod는 호출자가
 * 전달한 buildDate(SITE_BUILD_DATE)를 쓴다.
 */
export function buildLongTailEntries(
    tickers: readonly string[],
    buildDate: Date
): SitemapEntry[] {
    return tickers.map(
        (ticker): SitemapEntry => ({
            url: `${SITE_URL}/${ticker}`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: LONGTAIL_CHART_PRIORITY,
        })
    );
}
