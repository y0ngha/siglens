import { getMarketFearGreedCryptoStatic } from '@/entities/market-fear-greed/api/marketFearGreedCryptoStaticCache';
import { getMarketFearGreedKrStatic } from '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache';
import { getMarketFearGreedStatic } from '@/entities/market-fear-greed/api/marketFearGreedStaticCache';
import type {
    MarketFearGreedHubView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';
import type { FearGreedDataMarket } from '@/shared/config/fearGreedData';

/**
 * 시장별 허브 뷰 로더. 허브 페이지와 같은 정적 캐시를 읽으므로 파일 요청이 업스트림 호출을
 * 더하지 않는다(같은 Redis·데이터 캐시 항목).
 */
export const FEAR_GREED_DATA_LOADERS: Record<
    FearGreedDataMarket,
    () => Promise<MarketFearGreedHubView<MarketFearGreedViewSnapshot>>
> = {
    us: getMarketFearGreedStatic,
    kr: getMarketFearGreedKrStatic,
    crypto: getMarketFearGreedCryptoStatic,
};
