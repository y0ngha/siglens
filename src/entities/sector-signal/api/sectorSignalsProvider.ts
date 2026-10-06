import 'server-only';
import type {
    DashboardTimeframe,
    MarketDataProvider,
} from '@y0ngha/siglens-core';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import {
    marketDataProviderFor,
    scopeUsesFmp,
} from '@/shared/api/market/getMarketDataProvider';
import { sessionSpecForDashboardScope } from '@/shared/api/market/sessionSpecFor';

/**
 * 섹터 신호 스캔이 봉·시세를 읽을 provider.
 *
 * ## 왜 캐시 provider인가 (2026-10)
 *
 * 예전에는 raw provider(`marketDataProviderFor`)를 썼다. 미국 scope 일봉 스캔은 ~80종목
 * 각각에 `historical-price-eod/full`(400일) + `quote`(오늘 봉) + `quote`(getQuote)를
 * 불렀다 — 리필 한 번에 FMP ~240회이고, 400일 일봉 응답을 매번 통째로 받았다. 캐시
 * provider(`CachedMarketDataProvider`)로 바꾸면 과거 일봉은 종목 페이지와 같은 세션 롤
 * 키(`bars:eodhist:<SYM>:<lastClosed>`)를 공유해 세션당 한 번만 받고(그 키는 보통 종목
 * 페이지의 5년 창이 이미 채워 둔다 — `isFresh`가 400일 커버를 확인한다), 리필 비용은
 * 60초 캐시된 오늘 봉·시세뿐이다.
 *
 * ## KR 인트라데이는 raw로 둔다
 *
 * core `getSectorSignals`는 `from`을 밀리초까지 담긴 ISO(`now − lookback`)로 넘긴다.
 * yahoo provider는 그 값을 그대로 쓰므로 캐시 provider의 단일 키 경로(`bars:raw:*`)에서
 * 키가 매번 달라져 **읽히지 않는 SET만 늘어난다**. FMP scope는 인트라데이도 날짜 단위
 * 히스토리/tail 분리(`intradayDateTimeZone`)가 키를 날짜로 정규화하고, 일봉은 어느
 * scope든 세션 날짜 키라 문제가 없다.
 */
export function sectorSignalsProviderFor(
    scope: DashboardScopeId,
    timeframe: DashboardTimeframe
): MarketDataProvider {
    if (timeframe === '1Day' || scopeUsesFmp(scope)) {
        return getCachedMarketDataProvider(sessionSpecForDashboardScope(scope));
    }
    return marketDataProviderFor(scope);
}
