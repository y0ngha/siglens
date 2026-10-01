import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { SYMBOL_INDEXABLE_LOCALES } from '@/shared/i18n/indexableLocales';
import { sitemapAlternates } from './sitemapAlternates';
import { CRYPTO_CHART_ISR_PERIOD_HOURS } from '@/shared/config/isr';
import { MS_PER_HOUR } from '@/shared/config/time';
import { SITE_URL } from '@/shared/lib/seo';
import { floorToHour } from './floorToHour';
import type { SitemapEntry } from '../model';
import { makeProseGate, type BuildPopularEntriesOptions } from './proseGate';

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
 * 종목 sitemap 엔트리에 다국어 대체본을 붙인다.
 *
 * 엔트리마다 손으로 `alternates`를 적지 않는 이유는 분기(산문 게이트 등)마다
 * 리터럴이 흩어지면 한 곳만 빠뜨려도 그 탭만 조용히 hreflang을 잃기 때문이다.
 * 마지막에 일괄로 붙인다.
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

/**
 * Crypto popular sitemap entries.
 *
 * lastmod uses the chart ISR period (6h, `CRYPTO_CHART_ISR_PERIOD_HOURS`) as a
 * common baseline via `quantizeTo6hBoundary` (news uses a rolling hour instead, below).
 *
 * `changeFrequency` per tab reflects editorial intent and is independent of lastmod:
 *   - chart (`revalidate=21600`, 6h) → `changeFrequency: 'daily'`, 6h-boundary lastmod.
 *   - news (`revalidate=43200`, 12h) → `changeFrequency: 'daily'`, rolling 1h-ago lastmod,
 *     floored to the hour (`floorToHour`) so repeated calls within the same hour agree
 *     (news is the most dynamic tab; 1h rolling accounts for on-demand revalidateTag that
 *     can refresh the page inside the ISR window).
 *   - fear-greed (`revalidate=86400`, 24h) → `changeFrequency: 'daily'`, UTC-midnight
 *     lastmod — the page regenerates at most daily, so a 6h boundary would over-claim.
 *
 * Only the crypto-applicable, indexable tabs are advertised (chart/news/fear-greed).
 * `/overall` is always noindex since the 2026-10-01 SEO audit
 * (`docs/architecture/SEO_RECOVERY_2026_09.md` §10 — `ALWAYS_NOINDEX_TAB_ROBOTS`), and
 * `/position` is always noindex (2026-09-11), so listing them would only burn crawl
 * budget. fundamental/financials/options/congress are not rendered for crypto.
 */
export function buildCryptoPopularEntries(
    now: Date,
    // `buildPopularEntries`와 같은 산문 게이트 — 뉴스 탭은 자산군과 무관하게
    // 산문이 없으면 noindex일 수 있다. 없으면(로더 실패) 필터를 끈다.
    { symbolTabsWithProse }: BuildPopularEntriesOptions = {}
): SitemapEntry[] {
    const hasProse = makeProseGate({ symbolTabsWithProse });
    const boundary6h = quantizeTo6hBoundary(now);
    const utcMidnight = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
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
            ...(hasProse(sym, 'news')
                ? [
                      {
                          url: `${SITE_URL}/${sym}/news`,
                          lastModified: oneHourAgo,
                          changeFrequency: 'daily' as const,
                          priority: 0.75,
                      },
                  ]
                : []),
            // 공포탐욕 탭은 2026-10-01부터 색인한다(`[symbol]/fear-greed/page.tsx`
            // generateMetadata 주석). `/overall`·`/position`은 항상 noindex라 싣지 않는다.
            {
                url: `${SITE_URL}/${sym}/fear-greed`,
                lastModified: utcMidnight,
                changeFrequency: 'daily',
                priority: 0.75,
            },
        ])
    );
}
