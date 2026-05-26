import { NextResponse } from 'next/server';
import {
    buildLongTailEntries,
    loadLongTailTickers,
    LONGTAIL_ENTRIES_PER_TICKER,
    SITEMAP_MAX_URLS_PER_FILE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * 한 sitemap 파일에 담을 수 있는 티커 수.
 * 티커당 LONGTAIL_ENTRIES_PER_TICKER개 URL을 생성하므로,
 * SITEMAP_MAX_URLS_PER_FILE을 넘지 않도록 역산한다.
 */
const TICKERS_PER_PAGE = Math.floor(
    SITEMAP_MAX_URLS_PER_FILE / LONGTAIL_ENTRIES_PER_TICKER
);

interface RouteContext {
    params: Promise<{ page: string }>;
}

export async function GET(
    _req: Request,
    { params }: RouteContext
): Promise<Response> {
    const { page } = await params;
    const pageNum = Number.parseInt(page, 10);
    if (!Number.isFinite(pageNum) || pageNum < 1) {
        return new NextResponse('Invalid page number', { status: 404 });
    }

    const all = await loadLongTailTickers();
    const start = (pageNum - 1) * TICKERS_PER_PAGE;
    const chunk = all.slice(start, start + TICKERS_PER_PAGE);

    if (chunk.length === 0) {
        return new NextResponse('Page out of range', { status: 404 });
    }

    const entries = buildLongTailEntries(chunk, SITE_BUILD_DATE);
    const xml = toUrlSetXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
