import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/constants/time';
import { hasOptionsMarket } from '@/entities/options-chain';
import { SITE_URL } from '@/shared/lib/seo';
import type { SitemapEntry } from '../model';

// 미국 주식 시장 마감 시각(UTC). 16:00 ET = 20:00 UTC (DST 미고려).
const US_MARKET_CLOSE_UTC_HOUR = 20;

// hasOptionsMarket 동시 호출 상한 — Yahoo Finance rate-limit 보호.
// 한 sitemap 빌드가 POPULAR_TICKERS 전체를 병렬 요청하지 않도록 청크 단위로 묶는다.
const OPTIONS_PROBE_CONCURRENCY = 5;

function sliceIntoChunks<T>(items: ReadonlyArray<T>, size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, (i + 1) * size)
    );
}

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
 * POPULAR_TICKERS 각각에 hasOptionsMarket probe를 청크 단위로 호출하여
 * 옵션 시장이 있는 ticker set을 반환한다. 캐시 미스 시에도 동시 호출 수가
 * OPTIONS_PROBE_CONCURRENCY를 넘지 않도록 묶어 Yahoo Finance rate-limit
 * 위험을 방어한다. hasOptionsMarket은 1일 캐시라 두 번째 빌드부터는
 * fetch 없이 메모리에서 해결.
 */
async function probeOptionsMarket(
    tickers: ReadonlyArray<string>
): Promise<Set<string>> {
    const allChunks = sliceIntoChunks(tickers, OPTIONS_PROBE_CONCURRENCY);
    const chunkResults: boolean[][] = [];
    for (const chunk of allChunks) {
        const result = await Promise.all(
            chunk.map(ticker => hasOptionsMarket(ticker).catch(() => false))
        );
        chunkResults.push(result);
    }
    const flat = chunkResults.flat();
    return new Set(tickers.filter((_, i) => flat[i]));
}

/**
 * POPULAR_TICKERS의 모든 sub-route(차트/뉴스/펀더멘털/옵션/종합/공포탐욕)에
 * 대한 sitemap 엔트리를 반환한다. 옵션 페이지는 hasOptionsMarket이 true인
 * ticker만 포함 — 옵션 없는 종목 페이지는 noindex라 sitemap에 두면 품질
 * 신호가 약해진다.
 */
export async function buildPopularEntries(now: Date): Promise<SitemapEntry[]> {
    const todayClose = computeTodayAtMarketClose(now);
    const oneHourAgo = new Date(now.getTime() - MS_PER_HOUR);
    const tickersWithOptions = await probeOptionsMarket(POPULAR_TICKERS);

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
        ...(tickersWithOptions.has(ticker)
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
    ]);
}
