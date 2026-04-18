import type { MarketSummaryData } from '@/domain/types';
import {
    MARKET_INDICES,
    MARKET_SUMMARY_FMP_SYMBOLS,
    SECTOR_ETFS,
} from '@/domain/constants/dashboard-tickers';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

export async function getMarketSummary(): Promise<MarketSummaryData> {
    const provider = createMarketDataProvider();

    const quotes = await Promise.all(
        MARKET_SUMMARY_FMP_SYMBOLS.map(sym => provider.getQuote(sym))
    );

    const quoteMap = new Map(
        (quotes.filter(q => q !== null) as NonNullable<(typeof quotes)[number]>[]).map(
            q => [q.symbol, q]
        )
    );

    return {
        indices: MARKET_INDICES.map(idx => {
            const q = quoteMap.get(idx.fmpSymbol);
            return {
                symbol: idx.symbol,
                fmpSymbol: idx.fmpSymbol,
                displayName: idx.displayName,
                koreanName: idx.koreanName,
                price: q?.price ?? 0,
                changesPercentage: q?.changesPercentage ?? 0,
            };
        }),
        sectors: SECTOR_ETFS.map(etf => {
            const q = quoteMap.get(etf.symbol);
            return {
                symbol: etf.symbol,
                sectorName: etf.sectorName,
                koreanName: etf.koreanName,
                price: q?.price ?? 0,
                changesPercentage: q?.changesPercentage ?? 0,
            };
        }),
    };
}
