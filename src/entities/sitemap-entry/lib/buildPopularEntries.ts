import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_DAY, MS_PER_HOUR } from '@/shared/config/time';
import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

// 미국 주식 시장 마감 시각(UTC). 16:00 ET = 20:00 UTC (DST 미고려).
const US_MARKET_CLOSE_UTC_HOUR = 20;

const POPULAR_OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);

/**
 * 미국 장 마감 직후 시각을 반환한다. 오늘 close가 아직 미래라면 어제 close로
 * 클램프 — Googlebot이 미래 lastmod를 무시할 수 있어서.
 */
function computeTodayAtMarketClose(now: Date): Date {
    const candidate = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            US_MARKET_CLOSE_UTC_HOUR,
            0,
            0,
            0
        )
    );
    return candidate.getTime() <= now.getTime()
        ? candidate
        : new Date(candidate.getTime() - MS_PER_DAY);
}

/**
 * POPULAR_TICKERS의 모든 sub-route(차트/뉴스/펀더멘털/옵션/종합/공포탐욕/의회거래)에
 * 대한 sitemap 엔트리를 반환한다. 옵션 페이지는 generated static list에
 * 포함된 ticker만 포함 — 옵션 없는 종목 페이지는 noindex라 sitemap에 두면
 * 품질 신호가 약해진다.
 */
export function buildPopularEntries(now: Date): SitemapEntry[] {
    const todayClose = computeTodayAtMarketClose(now);
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);

    return POPULAR_TICKERS.flatMap((ticker): SitemapEntry[] => [
        {
            url: `${SITE_URL}/${ticker}`,
            lastModified: todayClose,
            changeFrequency: 'daily',
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/${ticker}/news`,
            lastModified: oneHourAgo,
            changeFrequency: 'hourly',
            priority: 0.78,
        },
        {
            url: `${SITE_URL}/${ticker}/fundamental`,
            lastModified: todayClose,
            changeFrequency: 'weekly',
            priority: 0.75,
        },
        {
            url: `${SITE_URL}/${ticker}/financials`,
            lastModified: todayClose,
            changeFrequency: 'monthly',
            priority: 0.73,
        },
        ...(POPULAR_OPTIONS_SET.has(ticker)
            ? [
                  {
                      url: `${SITE_URL}/${ticker}/options`,
                      lastModified: todayClose,
                      // ternary 안의 inline array literal은 outer flatMap의
                      // SitemapEntry[] annotation이 닿지 않아 'daily'가 string
                      // 으로 widening된다. 런타임 값은 항상 'daily'(=valid
                      // SitemapChangeFrequency)이므로 `as const`로 좁혀 safe.
                      changeFrequency: 'daily' as const,
                      priority: 0.75,
                  },
              ]
            : []),
        {
            url: `${SITE_URL}/${ticker}/overall`,
            lastModified: todayClose,
            changeFrequency: 'weekly',
            priority: 0.85,
        },
        {
            url: `${SITE_URL}/${ticker}/fear-greed`,
            lastModified: todayClose,
            changeFrequency: 'daily',
            priority: 0.78,
        },
        {
            url: `${SITE_URL}/${ticker}/congress`,
            lastModified: todayClose,
            changeFrequency: 'weekly',
            priority: 0.75,
        },
    ]);
}
