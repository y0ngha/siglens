import type { MetadataRoute } from 'next';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';
import { SITE_URL } from '@/lib/seo';
import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';

function parseBuildDate(): Date {
    const raw = process.env.NEXT_BUILD_DATE;
    if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
    }
    return new Date();
}

const SITEMAP_DATE = parseBuildDate();

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: SITE_URL,
            lastModified: SITEMAP_DATE,
            changeFrequency: 'hourly' as const,
            priority: 1,
        },
        {
            url: `${SITE_URL}/market`,
            lastModified: SITEMAP_DATE,
            changeFrequency: 'daily' as const,
            priority: 0.9,
        },
        ...POPULAR_TICKERS.map(ticker => ({
            url: `${SITE_URL}/${ticker}`,
            lastModified: SITEMAP_DATE,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        })),
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: SITEMAP_DATE,
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: SITEMAP_DATE,
            changeFrequency: 'yearly' as const,
            priority: 0.3,
        },
    ];
}
