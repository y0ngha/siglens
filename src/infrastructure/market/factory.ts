import { AlpacaProvider } from './alpaca';
import { FmpProvider } from './fmp';
import type { MarketDataProvider, MarketDataProviderType } from './types';

const MARKET_PROVIDER_MAP: Record<
    MarketDataProviderType,
    () => MarketDataProvider
> = {
    alpaca: () => new AlpacaProvider(),
    fmp: () => new FmpProvider(),
};

const DEFAULT_MARKET_PROVIDER: MarketDataProviderType = 'fmp';

export function createMarketDataProvider(): MarketDataProvider {
    const raw = process.env.MARKET_DATA_PROVIDER;
    const providerType =
        raw && raw in MARKET_PROVIDER_MAP
            ? (raw as MarketDataProviderType)
            : DEFAULT_MARKET_PROVIDER;
    return MARKET_PROVIDER_MAP[providerType]();
}
