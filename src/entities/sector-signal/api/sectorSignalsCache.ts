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
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

/** sector signals도 bars 일봉 TTL 정책을 재사용 — timeframe과 무관한 placeholder. */
const SIGNALS_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 종목 목록 fingerprint — cache 키에 박아 config 변경 시 자동 무효화. static
 * cache(sectorSignalsStaticCache)도 **이 상수를 import해** 동일 fingerprint를 공유한다.
 * 옛 fingerprint 키는 TTL(`computeBarsEffectiveTtl`, 최대 24h)로 자연 만료 — 별도 정리 불필요.
 */
export function sectorStocksConfigFingerprint(scope: DashboardScope): string {
    return createCacheConfigFingerprint(JSON.stringify(scope.sectorStocks));
}

/**
 * 섹터 신호를 cache→provider로 가져온다. marketSummaryCache와 동일 3계층:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request, computeBarsEffectiveTtl(장중 1분 / 장외 동적).
 * stocks가 빈 결과(전면 실패)는 캐시하지 않는다 — transient 장애를 TTL 동안 굳히지 않도록.
 * 키는 timeframe과 consumer-owned 종목 목록 fingerprint로 분리한다.
 */
export const getCachedSectorSignals = cache(
    async (
        provider: MarketDataProvider,
        scope: DashboardScope,
        timeframe: DashboardTimeframe
    ): Promise<SectorSignalsResult> =>
        getOrSetCache(
            `sector-signals:${scope.id}:${timeframe}:${sectorStocksConfigFingerprint(scope)}`,
            computeBarsEffectiveTtl(SIGNALS_TTL_TIMEFRAME, new Date()),
            () =>
                getSectorSignals(provider, [...scope.sectorStocks], timeframe),
            result => result.stocks.length > 0
        )
);
