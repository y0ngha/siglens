import type { Bar, Timeframe } from '@/domain/types';

export type { Bar, Timeframe };

export interface GetBarsOptions {
    symbol: string;
    timeframe: Timeframe;
    limit?: number;
    before?: string;
    from?: string;
}

export type MarketDataProviderType = 'alpaca' | 'fmp';

export interface MarketDataProvider {
    // now?: string — AlpacaProvider 전용 파라미터로, 테스트 시 현재 시각을 주입하기 위해 사용됩니다.
    // FmpProvider는 이 파라미터를 사용하지 않습니다.
    getBars(options: GetBarsOptions, now?: string): Promise<Bar[]>;
}
