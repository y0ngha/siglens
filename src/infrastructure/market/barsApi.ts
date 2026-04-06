import { calculateIndicators } from '@/domain/indicators';
import type { BarsData, Timeframe } from '@/domain/types';
import {
    TIMEFRAME_BARS_LIMIT,
    TIMEFRAME_LOOKBACK_DAYS,
} from '@/domain/constants/market';
import { createMarketDataProvider } from '@/infrastructure/market/factory';

function computeFromDate(timeframe: Timeframe, now: Date): string {
    const lookbackDays = TIMEFRAME_LOOKBACK_DAYS[timeframe];
    const from = new Date(now);
    from.setDate(from.getDate() - lookbackDays);
    return from.toISOString();
}

export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData> {
    const limit = TIMEFRAME_BARS_LIMIT[timeframe];
    const from = computeFromDate(timeframe, new Date());

    const provider = createMarketDataProvider();
    const bars = await provider.getBars({
        symbol,
        timeframe,
        limit,
        from,
    });

    const indicators = calculateIndicators(bars);
    return { bars, indicators };
}
