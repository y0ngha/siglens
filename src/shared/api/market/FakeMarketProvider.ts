import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketQuote,
} from '@y0ngha/siglens-core';
import bars from '@e2e/fixtures/bars.json';

// bars.json is authored to match the core Bar shape (time/open/high/low/close/volume).
const FIXTURE_BARS = bars as Bar[];

/**
 * E2E-only MarketDataProvider returning deterministic fixture data instead of
 * calling FMP. Reached only when E2E_TEST=1 (see getMarketDataProvider).
 */
export class FakeMarketProvider implements MarketDataProvider {
    async getBars(_options: GetBarsOptions): Promise<Bar[]> {
        return FIXTURE_BARS;
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        const last = FIXTURE_BARS.at(-1);
        if (last === undefined) return null;
        return {
            symbol,
            price: last.close,
            changesPercentage: 1.23,
            name: symbol,
        };
    }
}
