'use client';

import { useCallback, useState, useTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Timeframe } from '@/domain/types';
import { DEFAULT_TIMEFRAME } from '@/domain/constants/market';
import { QUERY_KEYS } from '@/lib/queryConfig';

interface UseTimeframeChangeResult {
    timeframe: Timeframe;
    handleTimeframeChange: (nextTimeframe: Timeframe) => void;
}

export function useTimeframeChange(symbol: string): UseTimeframeChangeResult {
    const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
    const [, startTransition] = useTransition();
    const queryClient = useQueryClient();

    const handleTimeframeChange = useCallback(
        (nextTimeframe: Timeframe): void => {
            if (nextTimeframe === timeframe) return;
            // 이전 타임프레임 쿼리 취소 — 불필요한 네트워크 요청 방지
            void queryClient.cancelQueries({
                queryKey: QUERY_KEYS.bars(symbol, timeframe),
            });
            startTransition(() => {
                setTimeframe(nextTimeframe);
            });
        },
        [timeframe, queryClient, symbol, startTransition]
    );

    return { timeframe, handleTimeframeChange };
}
