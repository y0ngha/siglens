import { cache } from 'react';
import type {
    MarketSummaryData,
    SectorSignalsResult,
} from '@y0ngha/siglens-core';
import { getMarketSummaryStatic } from '@/entities/market-summary/api/marketSummaryStaticCache';
import { getSectorSignalsStatic } from '@/entities/sector-signal/api/sectorSignalsStaticCache';
import { scopeUsesFmp } from '@/shared/api/market/getMarketDataProvider';
import {
    flagNoindexDegradedRender,
    shortenRevalidateForRuntimeDegrade,
    shortenRevalidateIfFmpFailedAtBuild,
} from '@/shared/cache/buildDegradedRevalidate';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

/** 시장 허브 두 로더의 결과와 degrade 판정 — metadata·본문·구조화데이터가 같은 값을 본다. */
export interface LoadMarketSignalsResult {
    summary: MarketSummaryData;
    sectorData: SectorSignalsResult;
    degraded: boolean;
}

/** 요약 로더를 감싸 실패를 빈 번들로 접고, 접었다는 사실을 값으로 돌려준다. */
async function loadSummarySafely(
    scope: DashboardScope,
    label: string
): Promise<{ summary: MarketSummaryData; failed: boolean }> {
    try {
        return { summary: await getMarketSummaryStatic(scope), failed: false };
    } catch (e) {
        console.error(
            `[${label}] getMarketSummaryStatic failed:`,
            redactDbErrorForLog(e)
        );
        return { summary: { indices: [], sectors: [] }, failed: true };
    }
}

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
    const [{ summary, failed: summaryFailed }, sectorData] = await Promise.all([
        loadSummarySafely(scope, label),
        getSectorSignalsStatic(scope, DEFAULT_DASHBOARD_TIMEFRAME).catch(e => {
            console.error(
                `[${label}] getSectorSignalsStatic failed:`,
                redactDbErrorForLog(e)
            );
            return { computedAt: '', stocks: [], failed: true };
        }),
    ]);
    // 빌드 중 FMP가 실패했으면 이 prerender를 60초 뒤 재생성되게 한다(헬퍼 JSDoc).
    // yahoo인 KRX scope는 FMP 상태와 무관하므로 건드리지 않는다.
    if (scopeUsesFmp(scope.id)) await shortenRevalidateIfFmpFailedAtBuild();
    return { summary, sectorData, summaryFailed };
});

/**
 * 요청당 한 번 읽은 두 로더 결과에 호출부의 폴백 `computedAt`을 덧씌우고 degrade를 판정한다.
 * 두 로더가 **모두** 빈 값일 때만 degraded다 — 한쪽에 콘텐츠가 있으면 비어 있지 않은 렌더다.
 */
export async function loadMarketSignals(
    scope: DashboardScope,
    /** 섹터 신호 폴백의 `computedAt`. 본문은 dateHour를, metadata는 빈 값을 쓴다. */
    computedAtFallback = ''
): Promise<LoadMarketSignalsResult> {
    const {
        summary,
        sectorData: loaded,
        summaryFailed,
    } = await loadMarketSignalsOnce(scope);
    // 섹터 로더가 실패했을 때만 호출부의 폴백 `computedAt`을 적용한다 — 캐시된
    // 결과는 호출부 간에 공유되므로 성공 결과의 `computedAt`은 건드리지 않는다.
    const sectorData =
        'failed' in loaded
            ? { computedAt: computedAtFallback, stocks: loaded.stocks }
            : loaded;
    const degraded =
        summary.indices.length === 0 &&
        summary.sectors.length === 0 &&
        sectorData.stocks.length === 0;
    // 핀은 `unstable_cache` 안이 아니라 렌더 경로(여기)에서 불러야 효과가 있다.
    // - 요약 로더가 던졌다: 빈 요약이 ISR에 3600초 굳지 않게 300초로 낮춘다. 섹터 데이터가 남아
    //   `degraded`가 아니어도 패널이 비므로 낮춘다(안내는 SSR seed의 빈 요약으로 클라가 띄운다).
    // - yahoo(KRX) 지수 시세 결측은 핀을 걸지 않는다: 그 번들은 `getMarketSummaryStatic`의 1시간
    //   Data Cache에 남아 300초 뒤 재생성도 같은 번들을 읽으므로, 핀은 동일한 ISR write만 늘린다.
    //   SSR 사본은 그 1시간 경계에서, 클라이언트 refetch는 그보다 먼저 회복한다.
    if (summaryFailed) await shortenRevalidateForRuntimeDegrade();
    // 색인 페이지가 입력원 장애로 `noindex` 껍데기가 됐다면 창이 지난 사본을 stale로 내보내지 않는다.
    if (degraded) await flagNoindexDegradedRender();
    return { summary, sectorData, degraded };
}
