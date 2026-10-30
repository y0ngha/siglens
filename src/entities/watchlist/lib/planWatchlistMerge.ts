import type { MergeWatchlistCandidate } from '@/shared/db/types';

interface WatchlistMergePlan {
    /** 이번에 삽입할 후보(입력 순서 유지). */
    toInsert: MergeWatchlistCandidate[];
    /** 상한 때문에 버려진 새 심볼 수. */
    skipped: number;
}

/**
 * 순수: 병합 후보 중 무엇을 넣고 몇 건을 버릴지 정한다. 후보는 최근 담은 순이어야 한다 —
 * 같은 심볼은 앞의 것만 남기고, 이미 계정에 있는 심볼은 어느 쪽에도 세지 않으며, 상한은
 * 기존 행 수를 뺀 여유만큼 앞에서부터 채운다. 소비처는 `DrizzleWatchlistRepository.mergeSymbols`.
 */
export function planWatchlistMerge(
    existingSymbols: ReadonlySet<string>,
    candidates: readonly MergeWatchlistCandidate[],
    limit: number
): WatchlistMergePlan {
    const seen = new Set<string>();
    const fresh = candidates.filter(({ symbol }) => {
        if (existingSymbols.has(symbol) || seen.has(symbol)) return false;
        seen.add(symbol);
        return true;
    });
    const capacity = Math.max(0, limit - existingSymbols.size);
    const toInsert = fresh.slice(0, capacity);
    return { toInsert, skipped: fresh.length - toInsert.length };
}
