import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { CRYPTO_CHART_ISR_PERIOD_HOURS } from '@/shared/config/isr';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

/**
 * Quantize `now` down to the most-recent 6h boundary (UTC midnight, 06:00, 12:00, 18:00).
 * Mirrors the ISR revalidate=21600 cadence of the crypto chart page so lastmod reflects
 * when the page was actually last regenerated rather than a rolling "now" that would
 * send a false signal to Googlebot and create unnecessary recrawl pressure.
 */
function quantizeTo6hBoundary(now: Date): Date {
    const utcHour = now.getUTCHours();
    const boundaryHour =
        Math.floor(utcHour / CRYPTO_CHART_ISR_PERIOD_HOURS) *
        CRYPTO_CHART_ISR_PERIOD_HOURS;
    return new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            boundaryHour,
            0,
            0,
            0
        )
    );
}

/**
 * Crypto popular sitemap entries.
 *
 * lastmod/changeFrequency are aligned with the actual ISR revalidation cadence of each
 * route so Googlebot does not recrawl faster than the content can change:
 *
 *   - chart (`revalidate=21600`, 6h) → `changeFrequency: 'daily'`, lastmod quantized to
 *     the last 6h UTC boundary.
 *   - news (`revalidate=43200`, 12h) → `changeFrequency: 'daily'`, rolling 1h-ago lastmod
 *     (news is the most dynamic tab; 1h rolling matches the stock convention and
 *     accounts for on-demand revalidateTag that can refresh the page inside the ISR window).
 *   - fear-greed (`revalidate=86400`, 24h) → `changeFrequency: 'daily'`, 6h-boundary lastmod.
 *   - overall (`revalidate=43200`, 12h) → `changeFrequency: 'weekly'`, 6h-boundary lastmod
 *     (AI analysis cache is slow-moving; weekly matches the stock overall convention).
 *
 * Only the crypto-applicable tabs are advertised (chart/news/fear-greed/overall) —
 * fundamental/financials/options/congress are not rendered for crypto.
 */
export function buildCryptoPopularEntries(now: Date): SitemapEntry[] {
    const boundary6h = quantizeTo6hBoundary(now);
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
    return POPULAR_CRYPTOS.flatMap((sym): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${sym}`,
            lastModified: boundary6h,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/${sym}/news`,
            lastModified: oneHourAgo,
            changeFrequency: 'daily',
            priority: 0.75,
        },
        {
            url: `${SITE_URL}/${sym}/fear-greed`,
            lastModified: boundary6h,
            changeFrequency: 'daily',
            priority: 0.72,
        },
        {
            url: `${SITE_URL}/${sym}/overall`,
            lastModified: boundary6h,
            changeFrequency: 'weekly',
            priority: 0.82,
        },
    ]);
}
