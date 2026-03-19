export type { Bar, Timeframe } from '@/domain/types';

export type GetBarsOptions = {
  symbol: string;
  timeframe: Timeframe;
  limit?: number;
  before?: string;
};

export interface MarketDataProvider {
  getBars(options: GetBarsOptions): Promise<Bar[]>;
}