import { NextResponse } from 'next/server';
import { loadLongTailTickers } from '@/infrastructure/sitemap/loadLongTailTickers';
import { SITEMAP_MAX_URLS_PER_FILE } from '@/infrastructure/sitemap/types';
import type { SitemapEntry } from '@/infrastructure/sitemap/types';
import { toUrlSetXml } from '@/infrastructure/sitemap/xml';
import { SITE_BUILD_DATE, SITE_URL } from '@/lib/seo';

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
    const start = (pageNum - 1) * SITEMAP_MAX_URLS_PER_FILE;
    const chunk = all.slice(start, start + SITEMAP_MAX_URLS_PER_FILE);

    // 빈 chunk = sitemap index가 노출한 페이지 수를 초과한 요청. 404로 명시.
    if (chunk.length === 0) {
        return new NextResponse('Page out of range', { status: 404 });
    }

    // long-tail은 weekly changeFreq + 빌드 시점 lastmod로 충분. POPULAR과 달리
    // 일·시간 단위 슬라이딩 시그널이 필요할 만큼 갱신 빈도가 높지 않다.
    const entries: SitemapEntry[] = chunk.map(ticker => ({
        url: `${SITE_URL}/${ticker}`,
        lastModified: SITE_BUILD_DATE,
        changeFrequency: 'weekly',
        priority: 0.5,
    }));

    const xml = toUrlSetXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
