import { NextResponse } from 'next/server';
import { buildStaticEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

// /market 엔트리의 1시간 슬라이딩 lastmod 때문에 빌드 시점 prerender 불가.
// CDN max-age 1h + SWR 1h로 trafic 보호.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    const xml = toUrlSetXml(buildStaticEntries(new Date()));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
