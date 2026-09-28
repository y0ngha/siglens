import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import { toUrlSetXml } from '@/entities/sitemap-entry/lib/xml';
import { loadPopularSitemapInputs } from '@/entities/sitemap-entry/server';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    const now = new Date();
    const inputs = await loadPopularSitemapInputs();
    const entries = buildCryptoPopularEntries(now, inputs);
    const xml = toUrlSetXml(entries);

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
