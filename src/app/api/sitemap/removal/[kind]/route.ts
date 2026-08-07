import { constants } from 'node:http2';
import { NextResponse } from 'next/server';

import {
    isRemovalSitemapKind,
    SITEMAP_MAX_URLS_PER_FILE,
    toRemovalUrlSetXml,
} from '@/entities/sitemap-entry';
import { loadRemovalSitemapEntries } from '@/entities/sitemap-entry/server';

import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_RETRY_AFTER_SECONDS,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';

interface RouteContext {
    params: Promise<{ kind: string }>;
}

const {
    HTTP_STATUS_INTERNAL_SERVER_ERROR,
    HTTP_STATUS_NOT_FOUND,
    HTTP_STATUS_SERVICE_UNAVAILABLE,
} = constants;

export const dynamic = 'force-dynamic';

export async function GET(
    _request: Request,
    { params }: RouteContext
): Promise<NextResponse> {
    const { kind } = await params;

    if (!isRemovalSitemapKind(kind)) {
        return new NextResponse(null, { status: HTTP_STATUS_NOT_FOUND });
    }

    try {
        const entries = await loadRemovalSitemapEntries(kind);

        if (entries.length > SITEMAP_MAX_URLS_PER_FILE) {
            console.error('[removal-sitemap] entry limit exceeded', {
                kind,
                count: entries.length,
            });
            return new NextResponse(null, {
                status: HTTP_STATUS_INTERNAL_SERVER_ERROR,
            });
        }

        return new NextResponse(toRemovalUrlSetXml(entries), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': SITEMAP_CACHE_CONTROL,
            },
        });
    } catch {
        console.error('[removal-sitemap] entry loading failed', { kind });
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
            },
        });
    }
}
