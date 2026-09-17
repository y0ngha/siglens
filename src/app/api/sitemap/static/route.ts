import { NextResponse } from 'next/server';
import { buildStaticEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import { loadStaticSitemapInputs } from '@/entities/sitemap-entry/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

// lastmod가 "직전 마감 세션"과 DB의 콘텐츠 갱신 시각에서 나오므로 빌드 시점
// prerender 불가. CDN max-age 1h + SWR 1h로 traffic 보호.
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const inputs = await loadStaticSitemapInputs();
    const xml = toUrlSetXml(buildStaticEntries(new Date(), inputs));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
