'use server';

import { type BarsData, type Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
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
        // Resolve profile once via cached getAssetInfo (DB-first → FMP); derive the
        // session spec directly from it — no assetClass→profileId round-trip.
        const marketProfile = await resolveMarketProfile(symbol);
        const session = sessionSpecFor(marketProfile);
        return await getCachedBarsWithIndicators(
            getCachedMarketDataProvider(session),
            symbol,
            timeframe,
            fmpSymbol,
            session
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
