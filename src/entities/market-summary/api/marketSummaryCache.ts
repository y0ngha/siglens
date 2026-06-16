import 'server-only';
import { cache } from 'react';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    type MarketDataProvider,
    type MarketSummaryData,
    type Timeframe,
    getMarketSummary,
    computeBarsEffectiveTtl,
} from '@y0ngha/siglens-core';
import { MARKET_INDICES, SECTOR_ETFS } from '@/shared/config/dashboard-tickers';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { allQuotesPresent } from '../lib/marketSummaryCompleteness';

/**
 * config(지수+섹터 ETF 목록) fingerprint — cache 키에 박아 config 변경 시 캐시를
 * 자동 무효화한다. static cache(marketSummaryStaticCache)도 **이 상수를 import해**
 * 동일 fingerprint를 공유하므로, 직렬화 포맷이 한쪽에서만 바뀌어 키가 어긋나는 일이 없다.
 *
 * Redis 키 누적: config가 바뀌면 새 fingerprint 키가 생기고 옛 키는 그대로 남지만,
 * 모든 엔트리에 TTL(`computeBarsEffectiveTtl`, 최대 24h)이 있어 자연 만료된다 —
 * 별도 정리 메커니즘 불필요. (config 변경은 배포 단위로 드물어 누적량도 미미.)
 */
export const MARKET_SUMMARY_CONFIG_FINGERPRINT = createCacheConfigFingerprint(
    JSON.stringify({ marketIndices: MARKET_INDICES, sectorEtfs: SECTOR_ETFS })
);
const MARKET_SUMMARY_CACHE_KEY = `market:summary:${MARKET_SUMMARY_CONFIG_FINGERPRINT}`;

/** 시장 요약은 bars 일봉 TTL 정책을 재사용 — 실제 timeframe과 무관한 placeholder. */
const SUMMARY_TTL_TIMEFRAME = '1Day' as const satisfies Timeframe;

/**
 * 대시보드 시장 요약(지수 + 섹터 ETF 현재 시세)을 cache→provider로 가져온다.
 *
 * 캐시 레이어:
 *   1. React.cache — 요청 내 dedup.
 *   2. Upstash Redis — cross-request. TTL은 bars와 동일한 개장-경계 정책을 재사용:
 *      `computeBarsEffectiveTtl`(장중 1분 / 장외·주말 min(24h, 다음 개장까지)).
 *      이 정책은 timeframe과 무관하므로 placeholder('1Day')를 전달한다. getOrSetCache가
 *      get→fetch→set과 Redis 미설정/장애 시 graceful fallback을 담당한다.
 *
 * quote가 0인 종목이 하나라도 있는 번들(부분 실패 포함)은 캐시하지 않는다
 * (`allQuotesPresent` 가드) — transient 장애를 TTL 동안 굳히지 않도록(barsDataCache
 * 빈봉 caution과 동일). 0은 FMP fetch 실패 신호이며, 클라이언트는 같은 기준으로
 * "데이터 일부 로드 실패" 안내를 띄운다(`hasMissingQuotes` 참조).
 */
export const getCachedMarketSummary = cache(
    async (provider: MarketDataProvider): Promise<MarketSummaryData> =>
        getOrSetCache(
            MARKET_SUMMARY_CACHE_KEY,
            computeBarsEffectiveTtl(SUMMARY_TTL_TIMEFRAME, new Date()),
            () => getMarketSummary(provider, MARKET_INDICES, SECTOR_ETFS),
            allQuotesPresent
        )
);
