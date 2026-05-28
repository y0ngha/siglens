'use server';

import { type BarsData, type Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    try {
        return await getCachedBarsWithIndicators(
            getMarketDataProvider(),
            symbol,
            timeframe,
            fmpSymbol
        );
    } catch (error) {
        logFmpPaymentRequiredError(error);
        const message = getFmpUserFacingMessage(error);
        if (message !== null) {
            throw new Error(message, { cause: error });
        }
        throw error;
    }
}
