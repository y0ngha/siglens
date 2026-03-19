import type { MarketDataProvider, GetBarsOptions, Bar } from './types';

export class AlpacaProvider implements MarketDataProvider {
  async getBars(options: GetBarsOptions): Promise<Bar[]> {
    // TODO: implement Alpaca API call
    void options;
    return [];
  }
}