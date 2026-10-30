import { constants } from 'node:http2';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';
import { rejectAiHost } from '@/app/api/sitemap/_shared/aiHostGuard';

const { HTTP_STATUS_GONE } = constants;

const LONGTAIL_SITEMAP_RETIRED_BODY = 'Longtail sitemap retired';

export const dynamic = 'force-dynamic';

/** 은퇴한 롱테일 sitemap — 410 Gone으로 답해 크롤러가 제출 항목을 정리하게 한다. */
export async function GET(request: Request): Promise<Response> {
    const aiHostRejection = rejectAiHost(request);
    if (aiHostRejection) return aiHostRejection;
    return new NextResponse(LONGTAIL_SITEMAP_RETIRED_BODY, {
        status: HTTP_STATUS_GONE,
        headers: {
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
