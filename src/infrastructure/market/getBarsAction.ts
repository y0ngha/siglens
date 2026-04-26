'use server';

import { fetchBarsWithIndicators } from '@y0ngha/siglens-core';
import type { BarsData, Timeframe } from '@/domain/types';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return fetchBarsWithIndicators(symbol, timeframe, fmpSymbol);
}
