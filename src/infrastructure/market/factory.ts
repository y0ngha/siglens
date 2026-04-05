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

function isProviderType(raw: string): raw is MarketDataProviderType {
    return raw in MARKET_PROVIDER_MAP;
}

export function createMarketDataProvider(): MarketDataProvider {
    const raw = process.env.MARKET_DATA_PROVIDER;
    const providerType =
        raw && isProviderType(raw) ? raw : DEFAULT_MARKET_PROVIDER;
    return MARKET_PROVIDER_MAP[providerType]();
}
