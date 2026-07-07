import {
    buildCryptoPopularEntries,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
    const now = new Date();
    const entries = buildCryptoPopularEntries(now);
    const xml = toUrlSetXml(entries);

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
