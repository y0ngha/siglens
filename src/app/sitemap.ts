import type { MetadataRoute } from 'next';
import { POPULAR_TICKERS, PRIVACY_PATH, SITE_URL, TERMS_PATH } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        {
            url: SITE_URL,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 1,
        },
        ...POPULAR_TICKERS.map(ticker => ({
            url: `${SITE_URL}/${ticker}`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        })),
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: now,
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: now,
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
    ];
}
