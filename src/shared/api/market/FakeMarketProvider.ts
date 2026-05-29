import type {
    Bar,
    GetBarsOptions,
    MarketDataProvider,
    MarketQuote,
} from '@y0ngha/siglens-core';
import bars from '@e2e/fixtures/bars.json';

/**
 * E2E-only MarketDataProvider returning deterministic fixture data instead of
 * calling FMP. Reached only when E2E_TEST=1 (see getMarketDataProvider).
 */
export class FakeMarketProvider implements MarketDataProvider {
    async getBars(_options: GetBarsOptions): Promise<Bar[]> {
        // bars.json is authored to match the core Bar shape (time/open/high/low/close/volume).
        return bars as Bar[];
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        // bars.json is authored to match the core Bar shape (time/open/high/low/close/volume).
        const last = (bars as Bar[]).at(-1);
        if (last === undefined) return null;
        return {
            symbol,
            price: last.close,
            changesPercentage: 1.23,
            name: symbol,
        };
    }
}
