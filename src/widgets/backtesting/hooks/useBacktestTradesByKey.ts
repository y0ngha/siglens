'use client';

import { useQuery } from '@tanstack/react-query';
import type { BacktestRunData, BacktestTrade } from '@y0ngha/siglens-core';
import { tradeKey } from '@/entities/backtest-case/lib/tradeKey';
import { validateBacktestRunData } from '@/entities/backtest-case/lib/validate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { BACKTEST_DATA_PUBLIC_PATH } from '../utils/backtestDataPath';

async function fetchBacktestRunData(): Promise<BacktestRunData> {
    const response = await fetch(BACKTEST_DATA_PUBLIC_PATH);
    if (!response.ok) {
        throw new Error(`backtest data: HTTP ${response.status}`);
    }
    return validateBacktestRunData(await response.json());
}

/** 서버 행(`data-trade-detail`)과 같은 키로 매매를 찾는 표. */
function toTradesByKey(
    data: BacktestRunData
): ReadonlyMap<string, BacktestTrade> {
    return new Map(data.trades.map(trade => [tradeKey(trade), trade]));
}

/**
 * 매매 상세용 실행 데이터를 키 → 매매 표로 준다. 처음 행을 펼칠 때만 불러온다(`enabled`) — 서버
 * HTML에는 접힌 줄만 싣고 상세를 빼서 페이지 크기를 줄였다. 정적 파일이라 다시 가져올 일이 없다.
 */
export function useBacktestTradesByKey(runId: string, enabled: boolean) {
    return useQuery({
        queryKey: QUERY_KEYS.backtestRun(runId),
        queryFn: fetchBacktestRunData,
        select: toTradesByKey,
        enabled,
        staleTime: Infinity,
        gcTime: Infinity,
    });
}
