// 슬라이스 public barrel — client-safe 순수 헬퍼·타입만 노출한다.
// `api/marketFearGreedStaticCache`는 server-only·next/cache에 의존하므로 여기서
// re-export하지 않는다(클라이언트 번들 누출 방지). 서버 소비자는
// `@/entities/market-fear-greed/api/marketFearGreedStaticCache`에서 직접 import.
export type {
    MarketFearGreedComparisonKey,
    MarketFearGreedComparisonPoint,
    MarketFearGreedView,
} from './model';

export { buildMarketFearGreedComparisons } from './lib/buildMarketFearGreedComparisons';
export {
    MARKET_FEAR_GREED_SERIES,
    MARKET_FEAR_GREED_SYMBOLS,
} from './lib/marketFearGreedSymbols';
