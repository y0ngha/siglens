'use client';

/**
 * 카드 폴링에 집계 분석 캐시 무효화를 붙인 훅 — 폴링이 끝났을 때 새로 보강된 카드가 있으면 `newsAnalysis`를 갱신한다.
 */
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
import {
    collectEnrichedCardIds,
    hasNewEnrichedCard,
} from '../utils/enrichedCardIds';

/**
 * 폴링 결과를 그대로 돌려주되, 폴링이 끝난 (상한 적용) 목록에 마운트 시점 기준선에 없던 보강 카드
 * id가 있으면 종목의 `newsAnalysis` 쿼리를 무효화해 집계 분석이 새 기사를 반영하게 한다.
 */
export function useNewsPollingWithInvalidation(
    symbol: string,
    initialItems: NewsDisplayItem[]
): UseNewsCardPollingReturn {
    const queryClient = useQueryClient();
    // Stored as state (not a ref) so the symbol-change reset below can use
    // setState during render without triggering the react-hooks/refs lint rule.
    // 기준선도 `capRows`를 통과시켜 훅이 **자기 완결적**이 되게 한다. 호출부가 상한 없이
    // 넘기면 기준선 모집단이 비교 대상(≤상한)보다 커져 무효화가 **영영 발생하지 않는다**.
    // 개수가 아니라 id 집합이라야 상한이 찬 목록에서 새 보강 행이 옛 행을 밀어내는 경우도 잡는다.
    const [baselineEnrichedIds, setBaselineEnrichedIds] = useState(() =>
        collectEnrichedCardIds(capRows(initialItems))
    );
    const [prevSymbol, setPrevSymbol] = useState(symbol);
    // Stable holder so useNewsCardPolling (data-fetch hook) is declared before
    // useCallback per REACT.md#HK-1. Kept current via useLayoutEffect below.
    const onCompleteRef = useRef<OnPollingComplete | undefined>(undefined);

    // Reset baseline on symbol change — React "store information from previous
    // renders" pattern.
    if (prevSymbol !== symbol) {
        setPrevSymbol(symbol);
        setBaselineEnrichedIds(collectEnrichedCardIds(capRows(initialItems)));
    }

    const result = useNewsCardPolling(
        symbol,
        initialItems,
        (finalItems: NewsDisplayItem[]) => onCompleteRef.current?.(finalItems)
    );

    const handlePollingComplete = useCallback(
        (finalItems: NewsDisplayItem[]) => {
            // 기준선과 **같은 모집단**에서 센다 — capRows 주석 참고.
            if (hasNewEnrichedCard(baselineEnrichedIds, capRows(finalItems))) {
                // `cancelRefetch: false` — 이미 도는 분석 스트림을 끊지 않는다. 끊어도 서버는
                // 버려진 작업을 끝까지 돌려 같은 분석에 LLM 비용이 두 번 든다.
                void queryClient.invalidateQueries(
                    { queryKey: QUERY_KEYS.newsAnalysisPrefix(symbol) },
                    { cancelRefetch: false }
                );
            }
        },
        [queryClient, symbol, baselineEnrichedIds]
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
