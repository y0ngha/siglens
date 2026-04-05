'use server';

import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import type { BarsData, Timeframe } from '@/domain/types';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe
): Promise<BarsData> {
    return fetchBarsWithIndicators(symbol, timeframe);
}
