'use client';

import { useQuery } from '@tanstack/react-query';
import type { MarketIndexData, MarketSectorData } from '@y0ngha/siglens-core';
import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { getMarketSummaryClientAction } from '@/entities/market-summary/actions';
import { hasMissingQuotes as detectMissingQuotes } from '@/entities/market-summary';
import {
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { isE2EClient } from '@/shared/api/e2eClientEnv';
import type { DashboardScopeId } from '@/shared/config/dashboardScope';

/**
 * Build-time-static E2E flag — evaluated once at module import.
 * NEXT_PUBLIC_E2E_TEST is inlined at build time so this is safe as a const.
 */
const IS_E2E_MODE = isE2EClient();

interface UseMarketSummaryReturn {
    data: MarketSummaryActionResult | undefined;
    isPending: boolean;
    sectorMap: Map<string, MarketSectorData>;
    indices: readonly MarketIndexData[];
    /**
     * summary가 있고 0(=FMP fetch 실패)인 종목이 하나라도 있으면 true. 캐시 가드
     * (`allQuotesPresent`)와 동일 기준 — 부분/전면 실패를 안내로 알리는 데 쓴다.
     */
    hasMissingQuotes: boolean;
}

function hasSummary(
    data: MarketSummaryActionResult | undefined
): data is Extract<MarketSummaryActionResult, { summary: unknown }> {
    return data !== undefined && !('ok' in data);
}

/**
 * 이 응답을 화면에 써도 되는가 — **롤링 배포 중 시장이 뒤바뀌는 것을 막는 가드**.
 *
 * ASG 갱신은 구·신 인스턴스를 최대 30분 함께 띄운다. Server Action id는 파일 경로와
 * export 이름에서 나와 배포 간에 안정적이므로, `/market/kr`을 보고 있는 새 클라이언트의
 * refetch가 **구 컨테이너로 라우팅될 수 있다.** 구 액션은 인자를 받지 않아 `'kr'`을
 * 그냥 버리고 미국 요약을 돌려주고, 화면에는 `₩` 기호를 단 S&P 500이 뜬다 —
 * 에러도, 로그도, 5xx도 없다. `staleTime`이 1분이라 그 화면이 30분 내내 갱신된다.
 *
 * 미국에서는 검사하지 않는다. 구 응답에는 `scope`가 아예 없어서(`undefined`)
 * 미국까지 엄격히 보면 배포 30분 동안 사이트에서 가장 트래픽이 많은 페이지가
 * 통째로 실패한다 — 기본값을 넣어 막았던 바로 그 회귀다. 그리고 구 컨테이너의
 * 답은 **정의상 미국**이라, 미국 페이지에서는 그 답이 옳다.
 */
function matchesScope(
    data: MarketSummaryActionResult | undefined,
    scope: DashboardScopeId
): boolean {
    if (scope === 'us') return true;
    return hasSummary(data) && data.scope === scope;
}

/**
 * @param scope - 어느 시장의 시세인가. 쿼리 키와 서버 액션 양쪽에 흐른다 —
 *   키에만 넣고 액션에 안 넘기면 캐시는 갈리는데 내용은 같아진다.
 */
export function useMarketSummary(
    scope: DashboardScopeId
): UseMarketSummaryReturn {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery<MarketSummaryActionResult>({
        queryKey: QUERY_KEYS.marketSummary(scope),
        queryFn: () => getMarketSummaryClientAction(scope),
        enabled: isHydrated,
        staleTime: IS_E2E_MODE ? 0 : MARKET_SUMMARY_STALE_TIME_MS,
        refetchOnMount: IS_E2E_MODE ? 'always' : undefined,
    });

    const resolved =
        hasSummary(data) && matchesScope(data, scope) ? data : undefined;

    /*
     * 수동 메모이제이션 없음 — `reactCompiler: true`가 이 파생값들을 자동으로 캐시한다.
     * 특히 `sectorMap`은 매 렌더 새 Map을 만들면 소비 컴포넌트가 전부 다시 그려지는
     * 자리라 캐시가 실제로 필요한데, 그 일을 컴파일러가 한다.
     */
    const sectorMap = new Map<string, MarketSectorData>(
        (resolved?.summary.sectors ?? []).map((s: MarketSectorData) => [
            s.symbol,
            s,
        ])
    );

    const indices = resolved?.summary.indices ?? [];

    const hasMissingQuotes = resolved
        ? detectMissingQuotes(resolved.summary)
        : false;

    return { data, isPending, sectorMap, indices, hasMissingQuotes };
}
