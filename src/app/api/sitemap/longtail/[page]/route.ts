import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

const LONGTAIL_SITEMAP_RETIRED_BODY = 'Longtail sitemap retired';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    return new NextResponse(LONGTAIL_SITEMAP_RETIRED_BODY, {
        status: 410,
        headers: {
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
