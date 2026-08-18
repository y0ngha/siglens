import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type DashboardTimeframe,
    type MarketDataProvider,
    type SectorSignalsResult,
    type Timeframe,
    getSectorSignals,
} from '@y0ngha/siglens-core';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { dashboardCacheTtlSeconds } from '@/shared/api/market/sessionSpecFor';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

/** sector signals도 bars 일봉 TTL 정책을 재사용 — timeframe과 무관한 placeholder. */
const SIGNALS_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 종목 목록 fingerprint — cache 키에 박아 config 변경 시 자동 무효화. static
 * cache(sectorSignalsStaticCache)도 **이 상수를 import해** 동일 fingerprint를 공유한다.
 * 옛 fingerprint 키는 TTL(`dashboardCacheTtlSeconds`, 최대 24h)로 자연 만료 — 별도 정리 불필요.
 */
export function sectorStocksConfigFingerprint(scope: DashboardScope): string {
    return createCacheConfigFingerprint(JSON.stringify(scope.sectorStocks));
}

/**
 * 섹터 신호를 cache→provider로 가져온다. marketSummaryCache와 동일 3계층:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request, dashboardCacheTtlSeconds(장중 1분 / 장외 동적, 한국은 하한 5분).
 * stocks가 빈 결과(전면 실패)는 캐시하지 않는다 — transient 장애를 TTL 동안 굳히지 않도록.
 *
 * **부분 실패는 이 계층에서 구분할 수 없다.** `result.stocks`는 "성공적으로 조회된
 * 종목"이 아니라 **"신호가 하나라도 잡힌 종목"**이다 — core
 * `computeStockSignalResult`가 `detectSignals`가 아무것도 못 찾으면 `null`을 돌려
 * 결과에서 빠진다. 그래서 `scope.sectorStocks.length` 대비 비율로 완전성을 재려는
 * 시도는 조용한 장에서 캐시 쓰기를 통째로 막는다(2026-08-19 리뷰에서 실제로
 * 그렇게 만들었다가 되돌림). yahoo 429로 18/20이 빠진 것과 그냥 시그널이 없는
 * 날은 이 반환 shape만으로는 같아 보인다. 구분하려면 provider/어댑터가 종목별
 * 조회 성공 여부를 따로 보고해야 한다 — 설계 문서 §8.1에 남긴다.
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
            dashboardCacheTtlSeconds(
                scope.id,
                SIGNALS_TTL_TIMEFRAME,
                new Date()
            ),
            () =>
                getSectorSignals(provider, [...scope.sectorStocks], timeframe),
            result => result.stocks.length > 0
        )
);
