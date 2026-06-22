import { constants } from 'node:http2';
import { getDatabaseClient } from '@/shared/db/client';
import {
    buildCryptoPopularEntries,
    buildLongTailEntries,
    toUrlSetXml,
} from '@/entities/sitemap-entry';
import {
    CRYPTO_LONGTAIL_CAP,
    DrizzleCryptoLongTailSource,
} from '@/entities/sitemap-entry/api';
import { SITE_BUILD_DATE } from '@/shared/lib/seo';
import { NextResponse } from 'next/server';
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_RETRY_AFTER_SECONDS,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';

const { HTTP_STATUS_SERVICE_UNAVAILABLE } = constants;

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
    const now = new Date();
    const popular = buildCryptoPopularEntries(now);

    try {
        const { db } = getDatabaseClient();
        const source = new DrizzleCryptoLongTailSource(db);
        const [eligible, longTailSymbols] = await Promise.all([
            source.count(),
            source.loadPage(1, CRYPTO_LONGTAIL_CAP),
        ]);

        // popular entries use `now` (sliding lastmod) so crawlers see these as
        // freshly updated each time the route serves — matching the high-priority
        // trading-volume signals they carry.  Long-tail entries use SITE_BUILD_DATE
        // because their content changes only when a new build deploys; advertising
        // the request time as lastmod would send crawlers a false freshness signal
        // and waste crawl budget on pages that haven't actually changed.
        const longTail = buildLongTailEntries(longTailSymbols, SITE_BUILD_DATE);
        const served = longTail.length;
        const dropped = eligible - served;

        // No silent caps: surface eligible vs served vs dropped so ops can see
        // exactly how many longtail crypto URLs were excluded by CRYPTO_LONGTAIL_CAP.
        if (dropped > 0) {
            console.warn(
                `[sitemap-crypto] cap dropped ${dropped} longtail entries (eligible=${eligible}, served=${served})`
            );
        }

        const xml = toUrlSetXml([...popular, ...longTail]);
        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': SITEMAP_CACHE_CONTROL,
            },
        });
    } catch (error) {
        console.error('[sitemap-crypto] DB access failed', error);
        return new NextResponse(SITEMAP_UNAVAILABLE_BODY, {
            status: HTTP_STATUS_SERVICE_UNAVAILABLE,
            headers: {
                'Retry-After': SITEMAP_RETRY_AFTER_SECONDS,
            },
        });
    }
}
