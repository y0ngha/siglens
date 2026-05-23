import { NextResponse } from 'next/server';
import { buildPopularEntries } from '@/infrastructure/sitemap/buildPopularEntries';
import { toUrlSetXml } from '@/infrastructure/sitemap/xml';

export async function GET(): Promise<Response> {
    const xml = toUrlSetXml(await buildPopularEntries(new Date()));
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
