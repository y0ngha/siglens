'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { NewsDisplayItem } from '@/shared/lib/types';
import {
    useNewsCardPolling,
    type OnPollingComplete,
    type UseNewsCardPollingReturn,
} from './useNewsCardPolling';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { capRows } from '../utils/capRows';

function isPendingAnalysis(item: NewsDisplayItem): boolean {
    return item.sentiment === null || item.priceImpact === null;
}

function countEnriched(items: NewsDisplayItem[]): number {
    return items.filter(item => !isPendingAnalysis(item)).length;
}

/**
 * Wraps `useNewsCardPolling` with React Query cache invalidation. When polling
 * completes and the final enriched card count exceeds the baseline captured at
 * mount, invalidates `newsAnalysis` queries for the symbol so the aggregate AI
 * analysis reflects all newly fetched articles.
 *
 * Extracts the cache-invalidation decision out of the presentation layer so
 * `NewsList` stays focused on rendering.
 */
export function useNewsPollingWithInvalidation(
    symbol: string,
    initialItems: NewsDisplayItem[]
): UseNewsCardPollingReturn {
    const queryClient = useQueryClient();
    // Stored as state (not a ref) so the symbol-change reset below can use
    // setState during render without triggering the react-hooks/refs lint rule.
    // 기준선도 `capRows`를 통과시켜 훅이 **자기 완결적**이 되게 한다. 지금은 유일한
    // 호출부가 이미 상한만큼 잘라서 넘기지만, 그러지 않는 호출부가 하나 생기는 순간
    // 기준선(≈1,400)이 비교 대상(≤50)보다 커져 무효화가 **영영 발생하지 않는다** —
    // 방금 고친 버그의 정확한 거울상이고, 조용히 실패한다는 점에서 더 나쁘다.
    const [initialEnrichedCount, setInitialEnrichedCount] = useState(() =>
        countEnriched(capRows(initialItems))
    );
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    // Stable holder so useNewsCardPolling (data-fetch hook) is declared before
    // useCallback per MISTAKES.md #17. Kept current via useLayoutEffect below.
    const onCompleteRef = useRef<OnPollingComplete | undefined>(undefined);

    // Reset baseline on symbol change — React "store information from previous
    // renders" pattern.
    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setInitialEnrichedCount(countEnriched(capRows(initialItems)));
    }

    const result = useNewsCardPolling(
        symbol,
        initialItems,
        (finalItems: NewsDisplayItem[]) => onCompleteRef.current?.(finalItems)
    );

    const handlePollingComplete = useCallback(
        (finalItems: NewsDisplayItem[]) => {
            // 기준선과 **같은 모집단**에서 센다 — capRows 주석 참고.
            if (countEnriched(capRows(finalItems)) > initialEnrichedCount) {
                void queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.newsAnalysisPrefix(symbol),
                });
            }
        },
        [queryClient, symbol, initialEnrichedCount]
    );

    useLayoutEffect(() => {
        onCompleteRef.current = handlePollingComplete;
    }, [handlePollingComplete]);

    // 렌더용 목록도 같은 상한으로 — 첫 페인트(서버가 준 상한 목록)와 폴링 이후가
    // 같은 길이를 유지해야 "더보기" 잔여 개수가 튀지 않는다.
    //
    // 자를 것이 없으면 `result`를 그대로 돌려준다.
    //
    // ⚠️ 이것은 **부분적인** 보호다. 실제로 잘리는 경로(=이 상한이 존재하는 이유)에서는
    // 매 렌더 새 배열과 새 객체가 나온다. 현재 소비자(`NewsList`)는 `items`를 렌더에서만
    // 읽으므로 안전하지만, 반환값이나 `items`를 의존성 배열에 넣는 소비자가 생기면
    // 재렌더 루프가 된다. 그때는 여기를 `useMemo`로 감쌀 것.
    const items = capRows(result.items);
    return items === result.items ? result : { ...result, items };
}
