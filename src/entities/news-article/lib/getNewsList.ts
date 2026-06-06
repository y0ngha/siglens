import { cache } from 'react';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleNewsRepository, type NewsRow } from '../api';
import { NEWS_LOOKBACK_MS } from './newsLookback';

/**
 * 같은 요청 안의 중복 호출(예: NewsPage 본문 + NewsListSection + OverallPage의 enrichment
 * 게이트 prop)을 `React.cache`로 per-request memoize해 DB 중복 조회를 막는다.
 *
 * 같은 lookback window(NEWS_LOOKBACK_MS)로 listBySymbol을 감싸므로 호출자별 다른 윈도우가
 * 필요해지면 별도 함수로 분리해야 한다. cross-request 캐싱은 손실 — 이슈 #439 참조.
 */
export const getNewsList = cache(async (symbol: string): Promise<NewsRow[]> => {
    const { db } = getDatabaseClient();
    const repo = new DrizzleNewsRepository(db);
    return repo.listBySymbol(symbol, NEWS_LOOKBACK_MS);
});
