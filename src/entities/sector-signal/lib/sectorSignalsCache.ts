import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type DashboardTimeframe,
    type MarketDataProvider,
    type SectorSignalsResult,
    type Timeframe,
    getSectorSignals,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';

/** sector signals도 bars 일봉 TTL 정책을 재사용 — timeframe과 무관한 placeholder. */
const SIGNALS_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 섹터 신호를 cache→provider로 가져온다. marketSummaryCache와 동일 3계층:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request, computeBarsEffectiveTtl(장중 1분 / 장외 동적).
 * stocks가 빈 결과(전면 실패)는 캐시하지 않는다 — transient 장애를 TTL 동안 굳히지 않도록.
 * 키는 timeframe별로 분리(sector-signals:{tf}).
 */
export const getCachedSectorSignals = cache(
    async (
        provider: MarketDataProvider,
        timeframe: DashboardTimeframe
    ): Promise<SectorSignalsResult> =>
        getOrSetCache(
            `sector-signals:${timeframe}`,
            computeBarsEffectiveTtl(SIGNALS_TTL_TIMEFRAME, new Date()),
            () => getSectorSignals(provider, timeframe),
            result => result.stocks.length > 0
        )
);
