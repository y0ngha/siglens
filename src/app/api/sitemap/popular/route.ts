import { NextResponse } from 'next/server';
import { buildPopularEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import { loadPopularSitemapInputs } from '@/entities/sitemap-entry/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

// 슬라이딩 lastmod 때문에 빌드 시점 prerender 불가. force-dynamic + CDN 1h
// max-age로 처리.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const inputs = await loadPopularSitemapInputs();
    const xml = toUrlSetXml(buildPopularEntries(new Date(), inputs));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
