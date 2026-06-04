'use server';

import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { getCachedSectorSignals } from '../lib/sectorSignalsCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';

export async function getSectorSignalsAction(
    timeframe?: DashboardTimeframe
): Promise<SectorSignalsResult> {
    try {
        return await getCachedSectorSignals(
            getMarketDataProvider(),
            timeframe ?? DEFAULT_DASHBOARD_TIMEFRAME
        );
    } catch (error) {
        console.error('[getSectorSignalsAction] failed:', error);
        return { computedAt: new Date().toISOString(), stocks: [] };
    }
}
