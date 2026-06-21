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

export async function GET(): Promise<Response> {
    const now = new Date();
    const popular = buildCryptoPopularEntries(now);

    const { db } = getDatabaseClient();
    const source = new DrizzleCryptoLongTailSource(db);
    const total = await source.count();
    const longTailSymbols = await source.loadPage(1, CRYPTO_LONGTAIL_CAP);
    const longTail = buildLongTailEntries(longTailSymbols, SITE_BUILD_DATE);

    // No silent caps: surface how much of the universe was dropped (§4.5).
    console.log(
        `[sitemap-crypto] popular=${popular.length} longtail=${longTail.length} (cap ${CRYPTO_LONGTAIL_CAP}, eligible≈${total})`
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
