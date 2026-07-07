import {
    type SitemapIndexEntry,
    toSitemapIndexXml,
} from '@/entities/sitemap-entry';
import { SITE_URL } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';
import { SITEMAP_CACHE_CONTROL } from '@/app/api/sitemap/_shared/constants';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
    const now = new Date();

    const entries: SitemapIndexEntry[] = [
        { url: `${SITE_URL}/sitemap-static.xml`, lastModified: now },
        { url: `${SITE_URL}/sitemap-popular.xml`, lastModified: now },
        { url: `${SITE_URL}/sitemap-crypto.xml`, lastModified: now },
    ];

    const xml = toSitemapIndexXml(entries);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': SITEMAP_CACHE_CONTROL,
        },
    });
}
