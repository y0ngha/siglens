import type { MetadataRoute } from 'next';
import { POPULAR_TICKERS, SITE_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    return [
        {
            url: SITE_URL,
            lastModified: now,
            changeFrequency: 'daily',
            priority: 1,
        },
        ...POPULAR_TICKERS.map(ticker => ({
            url: `${SITE_URL}/${ticker}`,
            lastModified: now,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        })),
    ];
}
