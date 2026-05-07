'use client';

import { useMemo } from 'react';
import {
    computeFearGreedIndex,
    computeFearGreedHistory,
    type Bar,
    type BuySellVolumeResult,
    type FearGreedSnapshot,
    type FearGreedHistoryPoint,
} from '@y0ngha/siglens-core';

interface UseFearGreedInput {
    bars: Bar[];
    buySellVolume: BuySellVolumeResult[];
}

interface UseFearGreedResult {
    snapshot: FearGreedSnapshot | null;
    history: FearGreedHistoryPoint[];
}

/**
 * useBars 결과로부터 fear & greed snapshot · history를 즉석 산출한다.
 * 별도 fetch · 캐시 신설 없이 useBars의 React Query staleTime에 자연 종속된다.
 */
export function useFearGreed({
    bars,
    buySellVolume,
}: UseFearGreedInput): UseFearGreedResult {
    return useMemo(
        () => ({
            snapshot: computeFearGreedIndex(bars, buySellVolume),
            history: computeFearGreedHistory(bars, buySellVolume),
        }),
        [bars, buySellVolume]
    );
}
