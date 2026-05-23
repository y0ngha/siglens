import { NextResponse, connection } from 'next/server';
import { buildStaticEntries } from '@/infrastructure/sitemap/buildStaticEntries';
import { toUrlSetXml } from '@/infrastructure/sitemap/xml';

// /market 엔트리의 1시간 슬라이딩 lastmod 때문에 빌드 시점 prerender 불가.
// CDN max-age 1h + SWR 1h로 trafic 보호.
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    // cacheComponents 모드의 build prerender attempt 차단 — new Date() 기반
    // 슬라이딩 lastmod가 빌드 시점에 고정되지 않도록 runtime dynamic을 보장한다.
    await connection();
    const xml = toUrlSetXml(buildStaticEntries(new Date()));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
