import { calculateIndicators } from '@/domain/indicators';
import type { BarsData, Timeframe } from '@/domain/types';
import {
    DEFAULT_BARS_LIMIT,
    TIMEFRAME_BARS_LIMIT,
} from '@/domain/constants/market';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';

/** hasMore 판단을 위해 limit보다 1개 더 요청하는 수 */
const LOOK_AHEAD_COUNT = 1;

export async function fetchBarsWithIndicators(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData> {
    const limit = TIMEFRAME_BARS_LIMIT[timeframe];
    const resolvedLimit = limit > 0 ? limit : DEFAULT_BARS_LIMIT;
    const market = new AlpacaProvider();

    const bars = await market.getBars({
        symbol,
        timeframe,
        limit: resolvedLimit + LOOK_AHEAD_COUNT,
    });

    const trimmedBars =
        bars.length > resolvedLimit ? bars.slice(0, resolvedLimit) : bars;
    const indicators = calculateIndicators(trimmedBars);
    return { bars: trimmedBars, indicators };
}
