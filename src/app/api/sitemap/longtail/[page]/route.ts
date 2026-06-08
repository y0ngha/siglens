import { NextResponse } from 'next/server';
import {
    buildLongTailEntries,
    SITEMAP_MAX_URLS_PER_FILE,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { loadLongTailTickerPage } from '@/entities/sitemap-entry/server';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';

const SITEMAP_RETRY_AFTER_SECONDS = '300';
const SITEMAP_UNAVAILABLE_BODY = 'Sitemap data temporarily unavailable';
const SITEMAP_PAGE_NOT_FOUND_BODY = 'Sitemap page not found';

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
    if (!/^[1-9]\d*$/.test(page)) {
        return new NextResponse(SITEMAP_PAGE_NOT_FOUND_BODY, { status: 404 });
    }

    const pageNum = Number.parseInt(page, 10);
    let chunk: readonly string[];

    try {
        chunk = await loadLongTailTickerPage(pageNum);
    } catch (error) {
        console.error('[sitemap] long-tail page failed', error);
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: 503,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
            },
        });
    }

    // 빈 chunk = sitemap index가 노출한 페이지 수를 초과한 요청. 404로 명시.
    if (chunk.length === 0) {
        return new NextResponse(SITEMAP_PAGE_NOT_FOUND_BODY, { status: 404 });
    }

    const entries = buildLongTailEntries(chunk, SITE_BUILD_DATE);
    if (entries.length > SITEMAP_MAX_URLS_PER_FILE) {
        console.error('[sitemap] long-tail page failed: URL cap exceeded', {
            pageNum,
            entries: entries.length,
            cap: SITEMAP_MAX_URLS_PER_FILE,
        });
        return new NextResponse('Sitemap page generation failed', {
            status: 500,
        });
    }

    const xml = toUrlSetXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
