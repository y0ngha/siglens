// DrizzleNewsRepository와 getNewsList는 barrel에서 제외 — api.ts가 drizzle/DB client를 import하고
// 'server-only'로 보호되므로 client bundle에 포함되면 build가 깨진다.
// server 소비자는 @/entities/news-article/api에서 직접 import한다.
export type { NewsRow } from './api';

// lib
export {
    type EnrichedNewsRow,
    isEnrichedRow,
    toEnrichedNewsItem,
} from './lib/newsEnrichment';
export {
    DISABLED_THINKING_BUDGET,
    NEWS_CARD_ANALYSIS_POLL_INTERVAL_MS,
    POLL_MAX_ATTEMPTS,
} from './lib/newsAnalysisConstants';
export {
    NEWS_LOOKBACK_MS,
    NEWS_ANALYSIS_LOOKBACK_MS,
} from './lib/newsLookback';
export { NEWS_LIST_CACHE_KEY } from './lib/cacheKeys';
// MAX_AGGREGATE_NEWS_ITEMS는 테스트가 expected length 단언에 import해 사용한다.
// selectAggregateNewsItems는 submitMarketNewsDigestAction에서 EnrichedNewsItem[]를 cap할 때
// 직접 사용한다 (buildAnalysisNewsItems가 아닌 경로 — 시그니처가 다름).
export {
    MAX_AGGREGATE_NEWS_ITEMS,
    selectAggregateNewsItems,
} from './lib/newsAnalysisSelection';
export { buildAnalysisNewsItems } from './lib/buildAnalysisNewsItems';
export { hashUrlToId, normalizeFmpPublishedDate } from './lib/fmpNewsClient';

// actions are imported from @/entities/news-article/actions
