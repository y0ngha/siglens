import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { sitemapAlternates } from './sitemapAlternates';
import { CRYPTO_CHART_ISR_PERIOD_HOURS } from '@/shared/config/isr';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import { floorToHour } from './floorToHour';
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
 * lastmod uses the chart ISR period (6h, `CRYPTO_CHART_ISR_PERIOD_HOURS`) as a
 * conservative common baseline for all tabs via `quantizeTo6hBoundary`. This is
 * shorter than fear-greed (revalidate=86400/24h) and overall (revalidate=43200/12h)
 * actual cadences — meaning lastmod conservatively under-claims freshness rather than
 * over-claiming it. Googlebot may recrawl those tabs less often than their true cadence
 * would allow, but we never send a false "this page is newer than it is" signal.
 *
 * `changeFrequency` per tab reflects editorial intent and is independent of lastmod:
 *   - chart (`revalidate=21600`, 6h) → `changeFrequency: 'daily'`, 6h-boundary lastmod.
 *   - news (`revalidate=43200`, 12h) → `changeFrequency: 'daily'`, rolling 1h-ago lastmod,
 *     floored to the hour (`floorToHour`) so repeated calls within the same hour agree
 *     (news is the most dynamic tab; 1h rolling accounts for on-demand revalidateTag that
 *     can refresh the page inside the ISR window).
 *   - fear-greed (`revalidate=86400`, 24h) → `changeFrequency: 'daily'`, 6h-boundary lastmod
 *     (actual cadence is 24h; lastmod baseline under-claims by 4×, which is conservative).
 *   - overall (`revalidate=43200`, 12h) → `changeFrequency: 'weekly'`, 6h-boundary lastmod
 *     (AI analysis cache is slow-moving; weekly matches the stock overall convention).
 *
 * Only the crypto-applicable tabs are advertised (chart/news/fear-greed/overall) —
 * fundamental/financials/options/congress are not rendered for crypto.
 */
/**
 * 종목 sitemap 엔트리에 다국어 대체본을 붙인다.
 *
 * 엔트리마다 손으로 `alternates`를 적지 않는 이유는 이 빌더가 티커당 8~9개
 * 엔트리를 만들고 분기(ETF·KR·옵션)마다 리터럴이 흩어져 있어서다 — 한 곳만
 * 빠뜨려도 그 탭만 조용히 hreflang을 잃는다. 마지막에 일괄로 붙인다.
 *
 * `SYMBOL_INDEXABLE_LOCALES`가 기본 로케일 하나인 동안에는 `sitemapAlternates`가
 * `undefined`를 돌려 XML이 지금과 바이트 단위로 동일하다.
 */
function withSymbolAlternates(entries: SitemapEntry[]): SitemapEntry[] {
    return entries.map(entry => {
        const alternates = sitemapAlternates(
            entry.url.slice(SITE_URL.length),
            SYMBOL_INDEXABLE_LOCALES
        );
        return alternates ? { ...entry, alternates } : entry;
    });
}

export function buildCryptoPopularEntries(now: Date): SitemapEntry[] {
    const boundary6h = quantizeTo6hBoundary(now);
    // floorToHour: rolling `now - 1h`를 그대로 쓰면 매 호출마다 값이 달라져
    // sitemap index lastmod의 freshness 신호가 무력화된다 — `buildPopularEntries`의
    // `/news` 엔트리와 같은 이유(floorToHour JSDoc 참고).
    const oneHourAgo = floorToHour(new Date(now.getTime() - MS_PER_HOUR));
    return withSymbolAlternates(
        POPULAR_CRYPTOS.flatMap((sym): SitemapEntry[] => [
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
        ])
    );
}
