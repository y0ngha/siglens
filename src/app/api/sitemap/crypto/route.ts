import { getDatabaseClient } from '@/shared/db/client';
import { buildCryptoPopularEntries } from '@/entities/sitemap-entry/lib/buildCryptoPopularEntries';
import {
    CRYPTO_LONGTAIL_CAP,
    DrizzleCryptoLongTailSource,
} from '@/entities/sitemap-entry/lib/cryptoLongTailSource';
import { buildLongTailEntries, toUrlSetXml } from '@/entities/sitemap-entry';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SITEMAP_RETRY_AFTER_SECONDS = '300';
const SITEMAP_UNAVAILABLE_BODY = 'Sitemap data temporarily unavailable';

export async function GET(): Promise<Response> {
    const now = new Date();
    const popular = buildCryptoPopularEntries(now);

    const { db } = getDatabaseClient();
    const source = new DrizzleCryptoLongTailSource(db);
    let eligible: number;
    let longTailSymbols: readonly string[];

    try {
        [eligible, longTailSymbols] = await Promise.all([
            source.count(),
            source.loadPage(1, CRYPTO_LONGTAIL_CAP),
        ]);
    } catch (error) {
        console.error('[sitemap-crypto] DB access failed', error);
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: 503,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
            },
        });
    }

    const longTail = buildLongTailEntries(longTailSymbols, SITE_BUILD_DATE);
    const served = longTail.length;
    const dropped = eligible - served;

    // No silent caps: surface eligible vs served vs dropped so ops can see
    // exactly how many longtail crypto URLs were excluded by CRYPTO_LONGTAIL_CAP.
    console.log(
        `[sitemap-crypto] popular=${popular.length} served=${served} eligible=${eligible} dropped=${dropped}`
    );

    const xml = toUrlSetXml([...popular, ...longTail]);
    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control':
                'public, max-age=3600, stale-while-revalidate=3600',
        },
    });
}
