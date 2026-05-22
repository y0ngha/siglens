import { NextResponse } from 'next/server';
import { PRIVACY_PATH, TERMS_PATH } from '@/lib/legal';
import { SITE_BUILD_DATE, SITE_URL } from '@/lib/seo';
import { POPULAR_TICKERS } from '@/domain/constants/popular-tickers';
import { MS_PER_DAY, MS_PER_HOUR } from '@/domain/constants/time';
import { hasOptionsMarket } from '@/infrastructure/options/optionsDataCache';

// Upstash Redis(`no-store` fetch)와 Yahoo Finance probe를 호출하기 때문에
// 빌드 시점 prerender가 불가능하다. force-dynamic으로 요청 시 생성하고,
// 트래픽 보호는 GET 응답의 Cache-Control(1h max-age + 1h SWR)에 위임한다.
export const dynamic = 'force-dynamic';

// 미국 주식 시장 마감 시각(UTC). 16:00 ET = 20:00 UTC (DST 미고려, 신호 용도라 충분).
const US_MARKET_CLOSE_UTC_HOUR = 20;

// `hasOptionsMarket` 동시 호출 상한. Yahoo Finance rate-limit 보호용 — 캐시
// 미스 시 한 번의 sitemap 빌드가 POPULAR_TICKERS 전체에 대해 병렬 요청을
// 보내지 않도록 청크 단위 await로 묶는다.
const OPTIONS_PROBE_CONCURRENCY = 5;

interface SitemapEntry {
    url: string;
    lastModified: Date;
    changeFrequency: string;
    priority: number;
}

// Slice a read-only sequence into fixed-size chunks. Pulled out of the
// inline `Array.from(..., (_, i) => items.slice(...))` expression because
// the slice arithmetic was non-trivial to read at the call site.
function sliceIntoChunks<T>(items: ReadonlyArray<T>, size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
        items.slice(i * size, (i + 1) * size)
    );
}

async function buildEntries(): Promise<SitemapEntry[]> {
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

    const ONE_HOUR_AGO = new Date(NOW.getTime() - MS_PER_HOUR);

    // 옵션 페이지는 옵션 시장이 형성된 종목만 sitemap에 포함한다 — 옵션
    // 없는 종목은 페이지 자체가 noindex로 처리되므로 sitemap에 두면
    // Google이 품질 신호를 약하게 본다. 캐시 미스 시 Yahoo Finance를
    // 무제한 동시 호출하지 않도록 OPTIONS_PROBE_CONCURRENCY개씩 청크로
    // 순차 처리해 rate-limit 위험을 방어한다. `hasOptionsMarket`은
    // 1일 캐시라 두 번째 sitemap 빌드부터는 fetch 없이 메모리에서 해결된다.
    const allChunks = sliceIntoChunks(
        POPULAR_TICKERS,
        OPTIONS_PROBE_CONCURRENCY
    );
    // 청크 단위 await로 동시 호출 수를 OPTIONS_PROBE_CONCURRENCY로 상한 유지.
    // Immutable accumulate via [...acc, result]: POPULAR_TICKERS / 5 ≈ 20 청크
    // 가 상한이라 O(N²) spread 비용은 무시 가능하고, FP 일관성을 우선한다.
    // 청크 전체를 Promise.all로 묶는 방식은 rate-limit을 깨뜨리므로 불가.
    let chunkResults: boolean[][] = [];
    for (const chunk of allChunks) {
        const result = await Promise.all(
            chunk.map(ticker => hasOptionsMarket(ticker).catch(() => false))
        );
        chunkResults = [...chunkResults, result];
    }
    const tickerHasOptions = chunkResults.flat();
    const tickersWithOptions = new Set(
        POPULAR_TICKERS.filter((_, i) => tickerHasOptions[i])
    );

    return [
        {
            // 메인은 마케팅 카피 + JSON-LD + 파일시스템 기반 Skills 카운트로
            // 구성돼 빌드 시점에만 콘텐츠가 변경된다. lastModified를 NOW로
            // 슬라이딩하면 거짓 신선도 신호가 돼 Googlebot의 크롤 가중치가
            // 점차 떨어질 수 있으므로 SITE_BUILD_DATE로 고정한다.
            url: SITE_URL,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 1,
        },
        {
            // /market은 장중 11개 섹터 신호 스캔을 노출하는 페이지로 실시간
            // 콘텐츠에 가깝다. news 페이지와 동일하게 1시간 단위 슬라이딩
            // lastModified를 적용해 CDN max-age=3600과 일관된 신호를 보낸다.
            url: `${SITE_URL}/market`,
            lastModified: ONE_HOUR_AGO,
            changeFrequency: 'hourly',
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/backtesting`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'monthly',
            priority: 0.9,
        },
        {
            url: `${SITE_URL}${PRIVACY_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        {
            url: `${SITE_URL}${TERMS_PATH}`,
            lastModified: SITE_BUILD_DATE,
            changeFrequency: 'yearly',
            priority: 0.3,
        },
        ...POPULAR_TICKERS.flatMap(ticker => [
            {
                url: `${SITE_URL}/${ticker}`,
                lastModified: TODAY_AT_MARKET_CLOSE,
                changeFrequency: 'daily',
                priority: 0.8,
            },
            {
                url: `${SITE_URL}/${ticker}/news`,
                lastModified: ONE_HOUR_AGO,
                changeFrequency: 'hourly',
                priority: 0.78,
            },
            {
                url: `${SITE_URL}/${ticker}/fundamental`,
                lastModified: TODAY_AT_MARKET_CLOSE,
                changeFrequency: 'weekly',
                priority: 0.75,
            },
            ...(tickersWithOptions.has(ticker)
                ? [
                      {
                          url: `${SITE_URL}/${ticker}/options`,
                          lastModified: TODAY_AT_MARKET_CLOSE,
                          changeFrequency: 'daily',
                          priority: 0.75,
                      },
                  ]
                : []),
            {
                url: `${SITE_URL}/${ticker}/overall`,
                lastModified: TODAY_AT_MARKET_CLOSE,
                changeFrequency: 'weekly',
                priority: 0.85,
            },
            {
                url: `${SITE_URL}/${ticker}/fear-greed`,
                lastModified: TODAY_AT_MARKET_CLOSE,
                changeFrequency: 'daily',
                priority: 0.78,
            },
        ]),
    ];
}

function toXml(entries: SitemapEntry[]): string {
    const urls = entries
        .map(
            ({ url, lastModified, changeFrequency, priority }) => `
  <url>
    <loc>${url}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
    <changefreq>${changeFrequency}</changefreq>
    <priority>${priority}</priority>
  </url>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
}

export async function GET(): Promise<Response> {
    const xml = toXml(await buildEntries());
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            // 옵션 신규 상장/폐지를 최대 2시간 내 반영하기 위해 SWR을 1시간으로
            // 단축한다 (M4의 6시간 Redis 캐시와 별개 레이어). 기존 24시간 SWR은
            // CDN edge가 하루 동안 stale sitemap을 그대로 노출해 옵션 페이지
            // index/de-index가 지연됐다.
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
