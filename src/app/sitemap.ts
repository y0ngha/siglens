import type { MetadataRoute } from 'next';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/lib/seo';
import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/constants/time';

type SitemapId = 'static' | 'tickers';

interface SitemapSegment {
    id: SitemapId;
}

// 미국 주식 시장 마감 시각(UTC). 16:00 ET = 20:00 UTC (DST 미고려, 신호 용도라 충분).
const US_MARKET_CLOSE_UTC_HOUR = 20;

export async function generateSitemaps(): Promise<SitemapSegment[]> {
    return [{ id: 'static' }, { id: 'tickers' }];
}

export default function sitemap({ id }: SitemapSegment): MetadataRoute.Sitemap {
    // Per-axis lastModified timestamps. These are signals to Google about
    // change frequency, not exact change times. We avoid per-ticker DB
    // lookups (would block sitemap generation on N queries) and instead
    // use deterministic axis-level offsets so distinct axes get distinct
    // timestamps, nudging Google toward granular re-crawl behavior.
    const NOW = new Date();
    // 20:00 UTC ≈ 16:00 ET (US market close). 오늘 close 시각이 아직 미래라면
    // 어제 close로 클램프 — Googlebot이 미래 lastModified를 무시할 수 있어서.
    const todayCloseCandidate = new Date(
        Date.UTC(
            NOW.getUTCFullYear(),
            NOW.getUTCMonth(),
            NOW.getUTCDate(),
            US_MARKET_CLOSE_UTC_HOUR,
            0,
            0,
            0
        )
    );
    const TODAY_AT_MARKET_CLOSE =
        todayCloseCandidate.getTime() <= NOW.getTime()
            ? todayCloseCandidate
            : new Date(todayCloseCandidate.getTime() - MS_PER_DAY);

    if (id === 'static') {
        return [
            {
                url: SITE_URL,
                lastModified: NOW,
                changeFrequency: 'hourly' as const,
                priority: 1,
            },
            {
                url: `${SITE_URL}/market`,
                lastModified: TODAY_AT_MARKET_CLOSE,
                changeFrequency: 'daily' as const,
                priority: 0.9,
            },
            {
                url: `${SITE_URL}/backtesting`,
                lastModified: SITE_BUILD_DATE,
                changeFrequency: 'monthly' as const,
                priority: 0.9,
            },
            {
                url: `${SITE_URL}${PRIVACY_PATH}`,
                lastModified: SITE_BUILD_DATE,
                changeFrequency: 'yearly' as const,
                priority: 0.3,
            },
            {
                url: `${SITE_URL}${TERMS_PATH}`,
                lastModified: SITE_BUILD_DATE,
                changeFrequency: 'yearly' as const,
                priority: 0.3,
            },
        ];
    }

    const ONE_HOUR_AGO = new Date(NOW.getTime() - MS_PER_HOUR);
    return POPULAR_TICKERS.flatMap(ticker => [
        {
            url: `${SITE_URL}/${ticker}`,
            lastModified: TODAY_AT_MARKET_CLOSE,
            changeFrequency: 'daily' as const,
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/${ticker}/news`,
            lastModified: ONE_HOUR_AGO,
            changeFrequency: 'hourly' as const,
            priority: 0.78,
        },
        {
            url: `${SITE_URL}/${ticker}/fundamental`,
            lastModified: TODAY_AT_MARKET_CLOSE,
            changeFrequency: 'weekly' as const,
            priority: 0.75,
        },
        {
            url: `${SITE_URL}/${ticker}/overall`,
            lastModified: TODAY_AT_MARKET_CLOSE,
            changeFrequency: 'weekly' as const,
            priority: 0.85,
        },
        {
            url: `${SITE_URL}/${ticker}/fear-greed`,
            lastModified: TODAY_AT_MARKET_CLOSE,
            changeFrequency: 'daily' as const,
            priority: 0.78,
        },
    ]);
}
