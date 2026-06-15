import {
    LONGTAIL_TICKERS_PER_PAGE,
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { countLongTailTickers } from '@/entities/sitemap-entry/server';
import { SITE_URL } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';

const SITEMAP_RETRY_AFTER_SECONDS = '300';
const SITEMAP_UNAVAILABLE_BODY = 'Sitemap data temporarily unavailable';

// long-tail count는 DB 기반 캐시 데이터라 빌드 시점 prerender 대상이 아니다.
// force-dynamic + CDN 1h cache로 처리.
export const dynamic = 'force-dynamic';

/**
 * 메인 sitemap은 sitemapindex로 동작한다 — sub-sitemap 여러 개를 가리키는
 * 메타 파일. 단일 urlset에 모든 URL을 박는 기존 방식은 sitemap.org 50,000개
 * 한도에 묶여 long-tail ticker 수가 늘어나면 파일이 invalid해진다. 분할 시
 * 각 sub-sitemap이 독립 cache + 독립 lastmod로 동작해 freshness 신호도 더
 * 정확해진다.
 *
 * 구성:
 *   - /sitemap-static.xml  : home/market/backtesting/legal (5 URL)
 *   - /sitemap-popular.xml : POPULAR_TICKERS × 5~6 routes (~1,000 URL)
 *   - /sitemap-longtail-{n}.xml : long-tail 종목당 메인 차트(/TICKER) 1 URL, page당 LONGTAIL_TICKERS_PER_PAGE tickers
 *
 * (Next.js rewrite는 next.config.ts에서 /sitemap-*.xml → /api/sitemap/* 으로 매핑)
 */
export async function GET(): Promise<Response> {
    const now = new Date();
    let longTailTickerCount: number;

    try {
        longTailTickerCount = await countLongTailTickers();
    } catch (error) {
        console.error('Sitemap count failed', error);
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: 503,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
            },
        });
    }

    const longTailPages = Math.ceil(
        longTailTickerCount / LONGTAIL_TICKERS_PER_PAGE
    );

    const longTailEntries: SitemapIndexEntry[] = Array.from(
        { length: longTailPages },
        (_, i) => ({
            url: `${SITE_URL}/sitemap-longtail-${i + 1}.xml`,
            // long-tail sub-sitemap은 SITE_BUILD_DATE 기준 lastmod를 쓰면 인스턴스별
            // Cold Start 시각 차이로 인덱스와 본문 간 불일치가 발생할 수 있다.
            // static/popular와 동일하게 now를 써서 crawler에 일관된 갱신 신호를 보낸다.
            lastModified: now,
        })
    );

    const entries: SitemapIndexEntry[] = [
        {
            url: `${SITE_URL}/sitemap-static.xml`,
            // static은 /market 1시간 슬라이딩 lastmod를 포함하므로 sub-sitemap의
            // lastmod도 now로 둬 crawler에 갱신 신호를 일관되게 보낸다.
            lastModified: now,
        },
        {
            url: `${SITE_URL}/sitemap-popular.xml`,
            // popular은 일/시간 단위 슬라이딩 lastmod 다수 포함. now로 둬 sub-
            // sitemap fetch를 유도한다 (CDN 1h cache가 비용 흡수).
            lastModified: now,
        },
        ...longTailEntries,
    ];

    const xml = toSitemapIndexXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
