import {
    buildCryptoPopularEntries,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
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
