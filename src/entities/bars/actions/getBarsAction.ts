'use server';

import { type BarsData, type Timeframe } from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveAssetClass } from '@/entities/ticker/lib/resolveAssetClass';
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
        // resolveAssetClass uses the cached getAssetInfo (DB-first → FMP) to determine the
        // asset class, then sessionSpecFor maps it to the core MarketSessionSpec for
        // session-aware Redis TTL (crypto=always-open 24/7, equity=ET session).
        const assetClass = await resolveAssetClass(symbol);
        const session = sessionSpecFor(
            assetClass === 'crypto' ? 'crypto' : 'us-equity'
        );
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
