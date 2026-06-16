// Public barrel for the market-news entity.
//
// EXCLUDED (server-only — would break client bundle if re-exported here):
//   - api.ts  (DrizzleMarketNewsRepository, getMarketNewsList — uses DB client + React.cache)
//   - actions/ and actions.ts (Server Actions — consumed via @/entities/market-news/actions)
//
// See entities/CLAUDE.md §barrel 제외 대상 for the general rule.

export type { MarketNewsRow, NewsFeedCategory } from './model';
export { CATEGORY_CONFIG, categoryFromSlug } from './lib/categoryConfig';
export type { CategoryConfig } from './lib/categoryConfig';
export {
    MARKET_NEWS_LOOKBACK_MS,
    MAX_MARKET_NEWS_CARDS,
    FMP_NEWS_FETCH_LIMIT,
} from './lib/marketNewsConstants';
