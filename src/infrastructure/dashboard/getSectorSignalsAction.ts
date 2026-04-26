'use server';

import { getSectorSignals } from '@y0ngha/siglens-core';
import type { DashboardTimeframe, SectorSignalsResult } from '@/domain/types';

export async function getSectorSignalsAction(
    timeframe?: DashboardTimeframe
): Promise<SectorSignalsResult> {
    return getSectorSignals(timeframe);
}
