import { MS_PER_HOUR } from '@/shared/config/time';
import { PRIVACY_PATH, TERMS_PATH } from '@/shared/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/shared/lib/seo';
import { CATEGORY_CONFIG, type NewsFeedCategory } from '@/entities/market-news';
import type { SitemapEntry } from '../model';

/**
 * 정적 라우트(home, market, backtesting, legal, news hub + 5 category pages)의 sitemap 엔트리.
 * /market은 장중 신호 스캐너를 노출하는 실시간성 페이지라 1시간 슬라이딩
 * lastmod를 적용하고, 그 외는 빌드 시점 고정(SITE_BUILD_DATE)으로 둬
 * Googlebot의 거짓 freshness 신호를 막는다.
 *
 * /news hub + /news/[category] 5개는 뉴스 흐름이 일 단위로 바뀌므로 daily
 * changeFrequency + priority 0.8(market보다 낮고 backtesting보다 높음).
 *
 * `now`를 인자로 받는 순수 함수라 테스트에서 시간 mock 없이 결정적 검증 가능.
 */
export function buildStaticEntries(now: Date): SitemapEntry[] {
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
    const newsCategoryEntries: SitemapEntry[] = (
        Object.keys(CATEGORY_CONFIG) as NewsFeedCategory[]
    ).map(cat => ({
        url: `${SITE_URL}/news/${CATEGORY_CONFIG[cat].slug}`,
        lastModified: SITE_BUILD_DATE,
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    return [
        {
            url: SITE_URL,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 1,
        },
        {
            url: `${SITE_URL}/market`,
            lastModified: oneHourAgo,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/backtesting`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        // /news hub index
        {
            url: `${SITE_URL}/news`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        // /news/[category] — 5 entries, one per NewsFeedCategory
        ...newsCategoryEntries,
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
    ];
}
