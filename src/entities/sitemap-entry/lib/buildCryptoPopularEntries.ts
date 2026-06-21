import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

/**
 * Crypto popular sitemap entries. Crypto trades 24/7 (no market close) → use a
 * rolling 1-hour-ago lastmod for all routes. Only the crypto-applicable tabs
 * are advertised (chart/news/fear-greed/overall) — fundamental/financials/
 * options/congress are not rendered for crypto.
 */
export function buildCryptoPopularEntries(now: Date): SitemapEntry[] {
    const rolling = new Date(now.getTime() - MS_PER_HOUR);
    return POPULAR_CRYPTOS.flatMap((sym): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${sym}`,
            lastModified: rolling,
            changeFrequency: 'hourly',
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/${sym}/news`,
            lastModified: rolling,
            changeFrequency: 'hourly',
            priority: 0.75,
        },
        {
            url: `${SITE_URL}/${sym}/fear-greed`,
            lastModified: rolling,
            changeFrequency: 'daily',
            priority: 0.72,
        },
        {
            url: `${SITE_URL}/${sym}/overall`,
            lastModified: rolling,
            changeFrequency: 'daily',
            priority: 0.82,
        },
    ]);
}
