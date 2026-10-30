import {
    dehydrate,
    QueryClient,
    type DehydratedState,
} from '@tanstack/react-query';
import { marketSummarySeed } from '@/entities/market-summary/lib/marketSummarySeed';
import { DEFAULT_DASHBOARD_TIMEFRAME } from '@/shared/config/dashboard-tickers';
import type { DashboardScope } from '@/shared/config/dashboardScope';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { LoadMarketSignalsResult } from '../loadMarketSignals';

/**
 * `/market` 패널의 SSR seed를 만들어 dehydrate한다(요청 스코프 1회용 QueryClient).
 *
 * **컴포넌트 밖에 두는 이유**: `new QueryClient()`를 컴포넌트 본문에서 만들면 정적 분석
 * (react-doctor `query-stable-query-client`)이 클라이언트 컴포넌트의 실수로 잡는다. 서버
 * 컴포넌트라 요청당 새 클라이언트가 맞지만 규칙이 그 구분을 하지 못한다.
 *
 * `updatedAt`을 dateHour 버킷의 시작 시각으로 고정한다(src/app/CLAUDE.md#AP-2) — React Query `dehydrate`
 * 기본값은 `Date.now()`라 매 ISR 재생성마다 다른 timestamp가 HTML에 박혀 ISR write churn이 생긴다.
 * `dateHour`는 `'YYYY-MM-DDTHH'`(UTC) 형식이다.
 */
export function buildMarketDehydratedSeed(
    scope: DashboardScope,
    summary: LoadMarketSignalsResult['summary'],
    sectorDataSeed: LoadMarketSignalsResult['sectorData'],
    dateHour: string
): DehydratedState {
    const stableUpdatedAt = new Date(`${dateHour}:00:00.000Z`).getTime();
    const queryClient = new QueryClient();
    queryClient.setQueryData(
        QUERY_KEYS.marketSummary(scope.id),
        marketSummarySeed(scope.id, summary),
        { updatedAt: stableUpdatedAt }
    );
    queryClient.setQueryData(
        QUERY_KEYS.sectorSignals(scope.id, DEFAULT_DASHBOARD_TIMEFRAME),
        sectorDataSeed,
        { updatedAt: stableUpdatedAt }
    );
    return dehydrate(queryClient);
}
