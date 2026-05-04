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

type SitemapId = 'static' | 'tickers';

export async function generateSitemaps(): Promise<{ id: SitemapId }[]> {
    return [{ id: 'static' }, { id: 'tickers' }];
}

export default function sitemap({
    id,
}: {
    id: SitemapId;
}): MetadataRoute.Sitemap {
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
            20,
            0,
            0,
            0
        )
    );
    const TODAY_AT_MARKET_CLOSE =
        todayCloseCandidate.getTime() <= NOW.getTime()
            ? todayCloseCandidate
            : new Date(todayCloseCandidate.getTime() - 24 * 60 * 60 * 1000);

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
                lastModified: SITEMAP_DATE,
                changeFrequency: 'monthly' as const,
                priority: 0.9,
            },
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

    // id is narrowed to 'tickers' by exhaustive SitemapId union.
    const ONE_HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000);
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
    ]);
}
