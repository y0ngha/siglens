'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { BarsData, Timeframe } from '@/domain/types';
import { getBarsAction } from '@/infrastructure/market/getBarsAction';
import { QUERY_KEYS } from '@/lib/queryConfig';

const TIMEFRAME_QUERY_PARAM = 'tf';

interface UseTimeframeChangeResult {
    timeframe: Timeframe;
    /** 타임프레임이 변경된 누적 횟수. 0이면 초기 마운트, 1 이상이면 타임프레임 변경으로 인한 마운트다. */
    timeframeChangeCount: number;
    handleTimeframeChange: (nextTimeframe: Timeframe) => void;
}

export function useTimeframeChange(
    symbol: string,
    initialTimeframe: Timeframe
): UseTimeframeChangeResult {
    const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
    const [timeframeChangeCount, setTimeframeChangeCount] = useState(0);
    const [, startTransition] = useTransition();

    const queryClient = useQueryClient();
    const router = useRouter();

    const handleTimeframeChange = useCallback(
        (nextTimeframe: Timeframe): void => {
            if (nextTimeframe === timeframe) return;
            // 이전 타임프레임 쿼리 취소 — 불필요한 네트워크 요청 방지
            void queryClient.cancelQueries({
                queryKey: QUERY_KEYS.bars(symbol, timeframe),
            });
            // 새 타임프레임 데이터를 이벤트 핸들러 시점에 prefetch한다.
            // useSuspenseQuery가 렌더 도중 Server Action을 호출하면
            // Next.js 내부 Router 상태 업데이트와 충돌하므로,
            // 렌더 전에 쿼리 캐시에 데이터(또는 진행 중인 Promise)를 넣어둔다.
            void queryClient.prefetchQuery<BarsData>({
                queryKey: QUERY_KEYS.bars(symbol, nextTimeframe),
                queryFn: () => getBarsAction(symbol, nextTimeframe),
            });
            startTransition(() => {
                setTimeframeChangeCount(c => c + 1);
                setTimeframe(nextTimeframe);
                router.replace(
                    `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${nextTimeframe}`,
                    { scroll: false }
                );
            });
        },
        [timeframe, queryClient, symbol, router]
    );

    return { timeframe, timeframeChangeCount, handleTimeframeChange };
}
