'use client';

import { useWatchlistMerge } from '../hooks/useWatchlistMerge';

/** 루트 레이아웃이 한 번 마운트한다(`EmailReportNudgeHost` 옆). 렌더 결과는 없다. */
export function WatchlistMergeHost() {
    useWatchlistMerge();
    return null;
}
