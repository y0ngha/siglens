'use server';

import { getSectorSignals } from '@y0ngha/siglens-core';
import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';

export async function getSectorSignalsAction(
    timeframe?: DashboardTimeframe
): Promise<SectorSignalsResult> {
    try {
        return await getSectorSignals(getMarketDataProvider(), timeframe);
    } catch (error) {
        console.error('[getSectorSignalsAction] failed:', error);
        return { computedAt: new Date().toISOString(), stocks: [] };
    }
}
