import { cache } from 'react';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import type { DashboardScope } from '@/shared/config/dashboardScope';

/**
 * `/market`·`/market/kr`의 두 로더를 한 번에 읽고 **degrade 판정까지 여기서 내린다.**
 *
 * 판정식이 세 곳(metadata·본문·구조화데이터)에 흩어져 있으면 한 곳만 갱신돼도
 * 아무 것도 실패하지 않는다 — `robots: noindex`를 걸어 두고 같은 URL이 "정식
 * WebPage이고 11개 섹터를 담은 ItemList"라고 주장하는 상태가 되는데, 그건 화면에
 * 표시가 나지 않는다. 술어를 한 함수가 소유하면 갈릴 수가 없다.
 *
 * 두 로더 모두 `unstable_cache` 뒤에 있어 원천 조회는 한 번이지만, 같은 요청에서
 * metadata·본문·구조화데이터 세 곳이 부르면 Data Cache 읽기가 세 번 난다. 그래서
 * 실제 조회는 `scope`만으로 키가 잡히는 React `cache()` 안에 두어 요청당 한 번만
 * 실행한다 — 캐시 키는 `scope`뿐이다(호출부별 라벨을 인자로 받으면 키가 갈려
 * 중복 제거가 조용히 무효가 된다). 실패 로그는 scope id로 한 번만 남기고,
 * 호출부별 폴백 `computedAt`은 바깥에서 덧씌운다.
 * 외부 I/O(FMP·yahoo/Redis) 오류는 throw 대신 빈 안전값으로 폴백한다 —
 * throw가 전파되면 0-byte HTML이 ISR 캐시에 굳는다.
 */
const loadMarketSignalsOnce = cache(async (scope: DashboardScope) => {
    const label = `loadMarketSignals:${scope.id}`;
    const [summary, sectorData] = await Promise.all([
        getMarketSummaryStatic(scope).catch(e => {
            console.error(`[${label}] getMarketSummaryStatic failed:`, e);
            return { indices: [], sectors: [] };
        }),
        getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME).catch(e => {
            console.error(`[${label}] getSectorSignalsStatic failed:`, e);
            return { computedAt: '', stocks: [], failed: true };
        }),
    ]);
    return { summary, sectorData };
});

export async function loadMarketSignals(
    scope: DashboardScope,
    /** 섹터 신호 폴백의 `computedAt`. 본문은 dateHour를, metadata는 빈 값을 쓴다. */
    computedAtFallback = ''
) {
    const { summary, sectorData: loaded } = await loadMarketSignalsOnce(scope);
    // 섹터 로더가 실패했을 때만 호출부의 폴백 `computedAt`을 적용한다 — 캐시된
    // 결과는 호출부 간에 공유되므로 성공 결과의 `computedAt`은 건드리지 않는다.
    const sectorData =
        'failed' in loaded
            ? { computedAt: computedAtFallback, stocks: loaded.stocks }
            : loaded;
    return {
        summary,
        sectorData,
        // 두 로더가 **모두** 빈 값일 때만 degrade로 본다. 한쪽만 비어도 다른 쪽에
        // 콘텐츠가 있으면 페이지는 여전히 비어있지 않은 렌더다.
        degraded:
            summary.indices.length === 0 &&
            summary.sectors.length === 0 &&
            sectorData.stocks.length === 0,
    };
}
