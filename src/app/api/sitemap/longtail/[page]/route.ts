import { NextResponse } from 'next/server';
import {
    buildLongTailEntries,
    loadLongTailTickers,
    LONGTAIL_TICKERS_PER_PAGE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';

// DB 의존(no-store fetch)이라 force-dynamic. traffic 보호는 CDN cache에 위임.
export const dynamic = 'force-dynamic';

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
    const start = (pageNum - 1) * LONGTAIL_TICKERS_PER_PAGE;
    const chunk = all.slice(start, start + LONGTAIL_TICKERS_PER_PAGE);

    // 빈 chunk = sitemap index가 노출한 페이지 수를 초과한 요청. 404로 명시.
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
