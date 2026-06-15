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
        // 캐시 키에 pageSize(LONGTAIL_TICKERS_PER_PAGE)를 직접 포함한다. pageSize가 SQL
        // offset/limit에 박히므로, 값이 바뀌면 키가 자동으로 달라져 옛 page size로 캐시된 청크가
        // 서빙되지 않는다 — 수동 버전 bump가 불필요하고, 변경 누락으로 stale 청크가 1일 TTL 동안
        // 남는 위험이 사라진다.
        [`sitemap:longtail:page:${LONGTAIL_TICKERS_PER_PAGE}:${pageNumber}`],
        { revalidate: SECONDS_PER_DAY }
    )();
}
