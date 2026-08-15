import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
import { MS_PER_HOUR } from '@/shared/config/time';
import { lastClosedSessionCloseUtc } from '@/shared/lib/marketSessionDate';
import { POPULAR_OPTIONS_TICKERS } from '../config/popular-options-tickers';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

const POPULAR_OPTIONS_SET = new Set<string>(POPULAR_OPTIONS_TICKERS);

/**
 * POPULAR_TICKERS의 모든 sub-route(차트/뉴스/펀더멘털/옵션/종합/공포탐욕/의회거래)에
 * 대한 sitemap 엔트리를 반환한다. 옵션 페이지는 generated static list에
 * 포함된 ticker만 포함 — 옵션 없는 종목 페이지는 noindex라 sitemap에 두면
 * 품질 신호가 약해진다.
 *
 * `lastmod`는 `lastClosedSessionCloseUtc` — **마지막으로 마감된 미국 정규 세션의 마감
 * 순간**이다. 이전에는 "오늘 20:00 UTC(미래면 어제로 클램프)"를 직접 계산했는데,
 * 요일을 보지 않아 **토·일에는 열리지도 않은 장의 마감 시각**을 lastmod로 발행했다
 * (토 20:00 UTC 이후 크롤되면 1800여 URL이 전부 그렇게 나간다). 또 DST를 무시해
 * 겨울에는 실제 마감보다 1시간 일렀다. 공유 헬퍼는 주말 되감기와 DST를 모두 처리하고,
 * bars EOD 캐시 키가 쓰는 것과 같은 "마지막 마감 세션" 정의를 공유한다.
 *
 * `/{ticker}/news`만 1시간 슬라이딩을 유지한다 — 뉴스는 실제로 시간 단위로 바뀌고
 * on-demand `revalidateTag`가 ISR 창 안에서도 갱신하므로 슬라이딩이 사실에 가깝다.
 */
export function buildPopularEntries(now: Date): SitemapEntry[] {
    const todayClose = lastClosedSessionCloseUtc(now);
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
