import type { Bar, Timeframe } from '@/domain/types';

export type { Bar, Timeframe };

export interface GetBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    limit?: number;
    before?: string;
}

export type MarketDataProviderType = 'alpaca' | 'fmp';

export interface MarketDataProvider {
    getBars(options: GetBarsOptions, now?: string): Promise<Bar[]>;
}
