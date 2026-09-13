import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

const LONGTAIL_SITEMAP_RETIRED_BODY = 'Longtail sitemap retired';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    return new NextResponse(LONGTAIL_SITEMAP_RETIRED_BODY, {
        status: 410,
        headers: {
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
