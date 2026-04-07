import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const POPULAR_TICKERS = [
    'AAPL',
    'TSLA',
    'NVDA',
    'MSFT',
    'GOOGL',
    'AMZN',
] as const;

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
            changeFrequency: 'hourly' as const,
            priority: 0.8,
        })),
    ];
}
