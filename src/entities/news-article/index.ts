export { DrizzleNewsRepository, getNewsList, type NewsRow } from './api';

// lib
export {
    type EnrichedNewsRow,
    isEnrichedRow,
    toEnrichedNewsItem,
} from './lib/newsEnrichment';
export { DISABLED_THINKING_BUDGET } from './lib/newsAnalysisConstants';
export {
    NEWS_LOOKBACK_MS,
    NEWS_ANALYSIS_LOOKBACK_MS,
} from './lib/newsLookback';
// MAX_AGGREGATE_NEWS_ITEMS는 테스트가 expected length 단언에 import해 사용한다.
// selectAggregateNewsItems는 buildAnalysisNewsItems 안에서 캡슐화되어 외부 노출 불필요.
export { MAX_AGGREGATE_NEWS_ITEMS } from './lib/newsAnalysisSelection';
export { buildAnalysisNewsItems } from './lib/buildAnalysisNewsItems';

// actions are imported from @/entities/news-article/actions
