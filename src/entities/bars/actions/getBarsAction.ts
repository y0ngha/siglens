'use server';

import {
    type BarsData,
    type Tier,
    type Timeframe,
    isTimeframeAllowed,
} from '@y0ngha/siglens-core';
import { getCachedBarsWithIndicators } from '../lib/barsDataCache';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { resolveMarketProfile } from '@/entities/ticker/lib/resolveAssetClass';
import {
    getFmpUserFacingMessage,
    logFmpPaymentRequiredError,
} from '@/shared/api/fmp/fmpUserMessage';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';

async function resolveBarsTier(): Promise<Tier> {
    try {
        const user = await getCurrentUser();
        return await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        console.error('[getBarsAction] Failed to resolve caller tier:', error);
        return 'free';
    }
}

export async function getBarsAction(
    symbol: string,
    timeframe: Timeframe,
    fmpSymbol?: string
): Promise<BarsData> {
    const tier = await resolveBarsTier();
    if (!isTimeframeAllowed(tier, timeframe)) {
        throw new Error(
            `Timeframe ${timeframe} is not available for ${tier} tier.`
        );
    }

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
