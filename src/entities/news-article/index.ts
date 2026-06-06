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
/**
 * news list per-symbol cache 키 prefix. /news와 /overall page가 같은 SSR snapshot을
 * 공유하려면 staticSymbolCache 키 리터럴이 일치해야 한다(키 hash가 분리되면 cold path
 * 중복 fetch 발생).
 */
export const NEWS_LIST_CACHE_KEY = 'news:list' as const;
// MAX_AGGREGATE_NEWS_ITEMS는 테스트가 expected length 단언에 import해 사용한다.
// selectAggregateNewsItems는 buildAnalysisNewsItems 안에서 캡슐화되어 외부 노출 불필요.
export { MAX_AGGREGATE_NEWS_ITEMS } from './lib/newsAnalysisSelection';
export { buildAnalysisNewsItems } from './lib/buildAnalysisNewsItems';

// actions are imported from @/entities/news-article/actions
