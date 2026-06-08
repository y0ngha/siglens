import 'server-only';

import { unstable_cache } from 'next/cache';
import { SECONDS_PER_DAY } from '@/shared/config/time';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleLongTailTickerSource } from '../api';
import { LONGTAIL_TICKERS_PER_PAGE } from '../model';

export function loadLongTailTickerPage(
    pageNumber: number
): Promise<readonly string[]> {
    return unstable_cache(
        async () => {
            const client = getDatabaseClient();
            const source = new DrizzleLongTailTickerSource(client.db);
            return source.loadPage(pageNumber, LONGTAIL_TICKERS_PER_PAGE);
        },
        [`sitemap:longtail:page:v1:${pageNumber}`],
        { revalidate: SECONDS_PER_DAY }
    )();
}
