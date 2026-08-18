'use server';

import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedSectorSignals } from '../api/sectorSignalsCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * @param scope - 어느 시장의 신호인가. **직렬화를 건너온 값**이라 타입만으로는
 *   믿을 수 없어 런타임에서 좁힌다. 알 수 없는 값은 빈 결과로 떨어뜨린다 —
 *   미국으로 조용히 폴백하면 한국 페이지가 미국 종목을 그리고도 신호가 없다.
 */
export async function getSectorSignalsAction(
    scope: string,
    timeframe?: DashboardTimeframe
): Promise<SectorSignalsResult> {
    try {
        if (!isDashboardScopeId(scope)) {
            console.error('[getSectorSignalsAction] unknown scope:', scope);
            return { computedAt: new Date().toISOString(), stocks: [] };
        }
        const resolved = dashboardScopeOf(scope);
        return await getCachedSectorSignals(
            marketDataProviderFor(resolved.id),
            resolved,
            timeframe ?? DEFAULT_DASHBOARD_TIMEFRAME
        );
    } catch (error) {
        console.error('[getSectorSignalsAction] failed:', error);
        return { computedAt: new Date().toISOString(), stocks: [] };
    }
}
