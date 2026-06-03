'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
    MarketIndexData,
    MarketSectorData,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';
import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { getMarketSummaryAction } from '@/entities/market-summary/actions';
import { hasMissingQuotes as detectMissingQuotes } from '@/entities/market-summary';
import {
    MARKET_SUMMARY_STALE_TIME_MS,
    QUERY_KEYS,
} from '@/shared/config/queryConfig';
import { useHydrated } from '@/shared/hooks/useHydrated';

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
    /**
     * AI 브리핑 결과. 소비자(MarketSummaryPanel)가 raw `data` 구조를 파헤치지 않도록
     * 훅에서 추출해 노출한다(sectorMap/indices와 동일 패턴). 결과가 없거나 error/bot
     * 케이스면 `undefined` — 기존 `data?.briefing ?? undefined`와 동일하게 null도
     * undefined로 합친다(BriefingRegion의 undefined 분기 = 렌더 안 함).
     */
    briefing: SubmitBriefingResult | undefined;
}

function hasSummary(
    data: MarketSummaryActionResult | undefined
): data is Exclude<MarketSummaryActionResult, { ok: false }> {
    return data !== undefined && !('ok' in data);
}

export function useMarketSummary(): UseMarketSummaryReturn {
    const isHydrated = useHydrated();
    const { data, isPending } = useQuery({
        queryKey: QUERY_KEYS.marketSummary(),
        queryFn: getMarketSummaryAction,
        enabled: isHydrated,
        staleTime: MARKET_SUMMARY_STALE_TIME_MS,
    });

    const resolved = hasSummary(data) ? data : undefined;

    const sectorMap = useMemo(
        () =>
            new Map<string, MarketSectorData>(
                (resolved?.summary.sectors ?? []).map(s => [s.symbol, s])
            ),
        [resolved?.summary.sectors]
    );

    const indices = useMemo(
        () => resolved?.summary.indices ?? [],
        [resolved?.summary.indices]
    );

    const hasMissingQuotes = useMemo(
        () => (resolved ? detectMissingQuotes(resolved.summary) : false),
        [resolved]
    );

    const briefing = resolved?.briefing ?? undefined;

    return { data, isPending, sectorMap, indices, hasMissingQuotes, briefing };
}
