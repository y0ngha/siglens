'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { BacktestRunData } from '@y0ngha/siglens-core';
import { fetchBacktestRunData } from '@/entities/backtest-case/lib/fetchBacktestRunData';
import { toTradeRows } from '@/entities/backtest-case/lib/tradeRows';
import type { BacktestTradeRowModel } from '@/entities/backtest-case/model';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { groupCasesByMonth } from '../utils/groupCasesByMonth';

/** 월 키(`YYYY-MM`) → 그 달의 매매 행(서버 목록과 같은 순서). */
export type TradeRowsByMonth = ReadonlyMap<
    string,
    readonly BacktestTradeRowModel[]
>;

function toRowsByMonth(data: BacktestRunData): TradeRowsByMonth {
    return new Map(
        groupCasesByMonth(toTradeRows(data.trades)).map(group => [
            group.key,
            group.items,
        ])
    );
}

/**
 * 나중에 그리는 월 섹션용 매매 행을 월별로 준다. 상세 표(`useBacktestTradesByKey`)와 같은 쿼리를
 * 다른 `select`로 읽어 정적 파일은 한 번만 받는다. 처음 월을 펼칠 때만 불러온다(`enabled`).
 */
export function useBacktestTradeRowsByMonth(
    runId: string,
    enabled: boolean
): UseQueryResult<TradeRowsByMonth> {
    return useQuery({
        queryKey: QUERY_KEYS.backtestRun(runId),
        queryFn: () => fetchBacktestRunData(runId),
        select: toRowsByMonth,
        enabled,
        staleTime: Infinity,
        gcTime: Infinity,
    });
}
