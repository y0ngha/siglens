import { calculateIndicators } from '@/domain/indicators';
import type { BarsData, Timeframe } from '@/domain/types';
import { TIMEFRAME_BARS_LIMIT } from '@/domain/constants/market';
import { getBars } from '@/infrastructure/market/alpaca';

export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData> {
    const limit = TIMEFRAME_BARS_LIMIT[timeframe];

    const bars = await getBars({
        symbol,
        timeframe,
        limit,
    });

    const indicators = calculateIndicators(bars);
    return { bars, indicators };
}
