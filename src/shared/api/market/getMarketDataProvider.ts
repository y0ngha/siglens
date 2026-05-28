import type { MarketDataProvider } from '@y0ngha/siglens-core';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';

let cached: MarketDataProvider | null = null;

/** Returns the app's market data provider (FMP), constructed once and reused. */
export function getMarketDataProvider(): MarketDataProvider {
    cached ??= new FmpMarketProvider();
    return cached;
}
