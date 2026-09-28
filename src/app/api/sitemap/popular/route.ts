import { NextResponse } from 'next/server';
import { toUrlSetXml } from '@/entities/sitemap-entry/lib/xml';
import { loadPopularChildEntries } from '@/app/api/sitemap/_shared/childEntries';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

// 슬라이딩 lastmod 때문에 빌드 시점 prerender 불가. force-dynamic + CDN 1h
// max-age로 처리.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const xml = toUrlSetXml(await loadPopularChildEntries(new Date()));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
