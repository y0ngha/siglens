import { MS_PER_HOUR } from '@/domain/constants/time';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/lib/seo';
import type { SitemapEntry } from '@/infrastructure/sitemap/types';

/**
 * 정적 라우트(home, market, backtesting, legal)의 sitemap 엔트리.
 * /market은 장중 신호 스캐너를 노출하는 실시간성 페이지라 1시간 슬라이딩
 * lastmod를 적용하고, 그 외는 빌드 시점 고정(SITE_BUILD_DATE)으로 둬
 * Googlebot의 거짓 freshness 신호를 막는다.
 *
 * `now`를 인자로 받는 순수 함수라 테스트에서 시간 mock 없이 결정적 검증 가능.
 */
export function buildStaticEntries(now: Date): SitemapEntry[] {
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
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
