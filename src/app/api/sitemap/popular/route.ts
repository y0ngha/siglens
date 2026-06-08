import { NextResponse } from 'next/server';
import { buildPopularEntries, toUrlSetXml } from '@/entities/sitemap-entry';

// 슬라이딩 lastmod 때문에 빌드 시점 prerender 불가. force-dynamic + CDN 1h
// max-age로 처리.
export const dynamic = 'force-dynamic';

export function GET(): Response {
    const xml = toUrlSetXml(buildPopularEntries(new Date()));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
