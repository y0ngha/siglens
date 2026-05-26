import { NextResponse } from 'next/server';
import {
    loadLongTailTickers,
    LONGTAIL_TICKERS_PER_PAGE,
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { SITE_BUILD_DATE, SITE_URL } from '@/shared/lib/seo';

// loadLongTailTickers는 DB 조회(no-store fetch)라 빌드 시점 prerender 불가.
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
 *   - /sitemap-longtail-{n}.xml : long-tail × 5 routes (chart/news/fundamental/overall/fear-greed), page당 10,000 tickers
 *
 * (Next.js rewrite는 next.config.ts에서 /sitemap-*.xml → /api/sitemap/* 으로 매핑)
 */
export async function GET(): Promise<Response> {
    const now = new Date();
    const longTailTickers = await loadLongTailTickers();
    const longTailPages = Math.ceil(
        longTailTickers.length / LONGTAIL_TICKERS_PER_PAGE
    );

    // long-tail이 비어 있을 수 있다(DB 미설정/실패 시 graceful fallback).
    // 그 경우 longTailPages = 0이라 sub-sitemap 항목 자체가 빠지므로,
    // sitemap index는 static/popular 두 개만 참조한다.
    const longTailEntries: SitemapIndexEntry[] = Array.from(
        { length: longTailPages },
        (_, i) => ({
            url: `${SITE_URL}/sitemap-longtail-${i + 1}.xml`,
            // long-tail sub-sitemap은 SITE_BUILD_DATE 기준 lastmod (chunk 단위에서
            // 일·시간 단위 freshness 신호가 의미 없음 — 종목 페이지 자체는
            // changefreq weekly로 둠).
            lastModified: SITE_BUILD_DATE,
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
