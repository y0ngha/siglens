'use server';

import type {
    DashboardTimeframe,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { marketDataProviderFor } from '@/shared/api/market/getMarketDataProvider';
import { getCachedSectorSignals } from '../api/sectorSignalsCache';
import {
    DEFAULT_DASHBOARD_TIMEFRAME,
    isDashboardTimeframe,
} from '@/shared/config/dashboard-tickers';
import {
    dashboardScopeOf,
    isDashboardScopeId,
} from '@/shared/config/dashboardScope';

/**
 * @param scope - 어느 시장의 신호인가. **직렬화를 건너온 값**이라 타입만으로는
 *   믿을 수 없어 런타임에서 좁힌다.
 * @param timeframe - 봉 주기. 생략 시 기본값.
 *
 * ## 롤링 배포 호환
 *
 * ASG 갱신은 구·신 인스턴스를 최대 30분 함께 띄우고, Next의 Server Action id는
 * 파일 경로 + export 이름에서 나오므로 **옛 번들이 보낸 `(timeframe)` 한 개짜리
 * 호출이 새 구현에 그대로 도달한다.** 그러면 `scope`에 `'1Day'`가 들어와 검증에
 * 걸리고, `/market`의 신호 패널이 배포 중 30분간 통째로 빈다.
 *
 * 그래서 첫 인자가 timeframe 모양이면 인자를 한 칸 밀어 해석한다. 두 유니온은
 * 값이 겹치지 않아(`us`/`kr` vs `15Min`/`1Hour`/`1Day`) 판별이 모호하지 않다.
 * 한 릴리스 뒤에 이 보정을 걷어낸다.
 */
export async function getSectorSignalsAction(
    scope: string = 'us',
    timeframe?: DashboardTimeframe
): Promise<SectorSignalsResult> {
    try {
        const legacyCall =
            !isDashboardScopeId(scope) && isDashboardTimeframe(scope);
        const resolvedScopeId = legacyCall ? 'us' : scope;
        const resolvedTimeframe = legacyCall ? scope : timeframe;

        if (!isDashboardScopeId(resolvedScopeId)) {
            console.error(
                '[getSectorSignalsAction] unknown scope:',
                resolvedScopeId
            );
            return { computedAt: new Date().toISOString(), stocks: [] };
        }
        const resolved = dashboardScopeOf(resolvedScopeId);
        return await getCachedSectorSignals(
            marketDataProviderFor(resolved.id),
            resolved,
            resolvedTimeframe ?? DEFAULT_DASHBOARD_TIMEFRAME
        );
    } catch (error) {
        console.error('[getSectorSignalsAction] failed:', error);
        return { computedAt: new Date().toISOString(), stocks: [] };
    }
}
