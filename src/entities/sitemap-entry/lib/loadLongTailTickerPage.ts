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
        // 캐시 키 버전. pageSize(LONGTAIL_TICKERS_PER_PAGE)가 SQL offset/limit에 박히므로
        // 그 값을 바꾸면 키를 bump해 이전 page size로 캐시된 청크가 서빙되지 않게 한다
        // (v1=2000 → v2=10000). 안 그러면 1일 TTL 동안 옛 2000행 청크가 남아 롱테일 일부가 누락될 수 있다.
        [`sitemap:longtail:page:v2:${pageNumber}`],
        { revalidate: SECONDS_PER_DAY }
    )();
}
