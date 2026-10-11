'use client';

import { useQueries } from '@tanstack/react-query';
import type { Bar } from '@y0ngha/siglens-core';
import type { WatchlistItemView } from '@/entities/watchlist/model';
import { quoteFromBars } from '../lib/quoteFromBars';
import { watchlistQuoteQuery } from './useWatchlistQuote';

/**
 * 시세 쿼리 결과 → 등락률 배열(쿼리 순서 그대로). 모듈 수준에 둬 참조가 안정적이다 — 인라인
 * `combine`은 렌더마다 새 함수라 React Query가 결과를 다시 합친다.
 */
function changesOf(
    results: readonly { data?: { bars: readonly Bar[] } }[]
): (number | null)[] {
    return results.map(result =>
        result.data
            ? (quoteFromBars(result.data.bars)?.changePct ?? null)
            : null
    );
}

/**
 * `/watchlist` 등락률 정렬용 심볼별 등락률. `enabled`(사용자가 등락률 순을 골랐을 때)일 때만 구독한다 —
 * 평소에도 같은 키를 최대 50개 구독하면 행 시세가 도착할 때마다 목록 전체가 다시 그려진다.
 *
 * 켜면 아직 캐시에 없는 종목마다 `getBarsAction`이 나간다. Server Action은 클라이언트에서 한 번에
 * 하나씩 처리되므로 사실상 차례로 도착하고, 도착하는 대로 목록이 다시 정렬된다(시세를 모르는 행은
 * 맨 뒤). 사용자가 고를 때만 일어나는 일회성 비용이라 별도 상한은 두지 않는다.
 */
export function useWatchlistChanges(
    items: readonly WatchlistItemView[],
    enabled: boolean
): Map<string, number | null> {
    const changes = useQueries({
        queries: enabled
            ? items.map(item => watchlistQuoteQuery(item.symbol))
            : [],
        combine: changesOf,
    });
    // `useQueries` 결과는 `queries`와 같은 순서다 — 심볼은 `items`에서 바로 짝짓는다.
    return new Map(
        items.map((item, index) => [item.symbol, changes[index] ?? null])
    );
}
