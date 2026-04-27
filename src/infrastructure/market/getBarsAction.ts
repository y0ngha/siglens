'use server';

import { cacheLife, cacheTag } from 'next/cache';
import {
    type BarsData,
    type Timeframe,
    fetchBarsWithIndicators,
} from '@y0ngha/siglens-core';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    return getBarsCached(symbol, timeframe, fmpSymbol);
}

async function getBarsCached(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    'use cache';
    cacheLife('minutes');
    cacheTag(`bars:${fmpSymbol ?? symbol}:${timeframe}`);
    return fetchBarsWithIndicators(symbol, timeframe, fmpSymbol);
}
