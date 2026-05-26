import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

/**
 * long-tail 티커에 대한 sitemap 엔트리를 생성한다.
 * popular과 달리 옵션 라우트 제외, 낮은 priority, 고정 lastmod(SITE_BUILD_DATE).
 *
 * 순수 함수라 테스트에서 시간/외부 의존 mock 없이 결정적 검증 가능.
 */
export function buildLongTailEntries(
    tickers: readonly string[],
    buildDate: Date
): SitemapEntry[] {
    return tickers.flatMap((ticker): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${ticker}`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.5,
        },
        {
            url: `${SITE_URL}/${ticker}/news`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.45,
        },
        {
            url: `${SITE_URL}/${ticker}/fundamental`,
            lastModified: buildDate,
            changeFrequency: 'monthly',
            priority: 0.4,
        },
        {
            url: `${SITE_URL}/${ticker}/overall`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.45,
        },
        {
            url: `${SITE_URL}/${ticker}/fear-greed`,
            lastModified: buildDate,
            changeFrequency: 'weekly',
            priority: 0.4,
        },
    ]);
}
