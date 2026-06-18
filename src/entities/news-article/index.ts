export { DrizzleNewsRepository, getNewsList, type NewsRow } from './api';

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
