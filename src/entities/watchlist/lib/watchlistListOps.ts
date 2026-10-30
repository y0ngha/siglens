import type { WatchlistItemView, WatchlistMutationContext } from '../model';

/**
 * 순수: 목록의 `index` 자리에 한 건을 끼운다. `toSpliced`는 클라이언트 폴리필 목록
 * (`legacyBrowserPolyfills`)에 없어 slice로 잇는다. 소비처는 `useWatchlistQuery`의 롤백.
 */
export function insertWatchlistItemAt(
    list: WatchlistItemView[],
    item: WatchlistItemView,
    index: number
): WatchlistItemView[] {
    const at = Math.min(index, list.length);
    return [...list.slice(0, at), item, ...list.slice(at)];
}

/**
 * 순수: 담기 실패 롤백. 그 심볼만 변이 전 상태(없었으면 없음)로 돌려, 동시에 진행 중인 다른
 * 심볼의 낙관적 행을 건드리지 않는다.
 */
export function rollbackAddedItem(
    list: WatchlistItemView[],
    context: WatchlistMutationContext
): WatchlistItemView[] {
    const without = list.filter(item => item.symbol !== context.symbol);
    return context.prior
        ? insertWatchlistItemAt(without, context.prior, context.index)
        : without;
}

/** 순수: 빼기 실패 롤백. 지운 행만 원래 자리에 다시 넣는다(이미 돌아와 있으면 그대로). */
export function rollbackRemovedItem(
    list: WatchlistItemView[],
    context: WatchlistMutationContext
): WatchlistItemView[] {
    const { prior, index, symbol } = context;
    if (!prior || list.some(item => item.symbol === symbol)) return list;
    return insertWatchlistItemAt(list, prior, index);
}
