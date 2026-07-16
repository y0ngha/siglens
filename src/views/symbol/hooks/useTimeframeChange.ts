'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { Timeframe } from '@y0ngha/siglens-core';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';
import { getBarsAction } from '@/entities/bars/actions';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';

const TIMEFRAME_QUERY_PARAM = 'tf';

interface UseTimeframeChangeResult {
    timeframe: Timeframe;
    /** 타임프레임이 변경된 누적 횟수. 0이면 초기 마운트, 1 이상이면 타임프레임 변경으로 인한 마운트다. */
    timeframeChangeCount: number;
    handleTimeframeChange: (nextTimeframe: Timeframe) => void;
}

export function useTimeframeChange(
    symbol: string,
    isFreeTier: boolean,
    isTierHydrated: boolean
): UseTimeframeChangeResult {
    const [timeframeChangeCount, setTimeframeChangeCount] = useState(0);
    const [, startTransition] = useTransition();

    const searchParams = useSearchParams();
    const assetInfo = useAssetInfo(symbol);
    const queryClient = useQueryClient();
    const router = useRouter();

    const tf = searchParams.get(TIMEFRAME_QUERY_PARAM);
    const requestedTimeframe = isValidTimeframe(tf) ? tf : DEFAULT_TIMEFRAME;
    const timeframe =
        (!isTierHydrated || isFreeTier) &&
        requestedTimeframe !== DEFAULT_TIMEFRAME
            ? DEFAULT_TIMEFRAME
            : requestedTimeframe;
    const previousTimeframeRef = useRef<Timeframe>(timeframe);
    const pendingNavigationRef = useRef<Timeframe | null>(null);

    const handleTimeframeChange = useCallback(
        (nextTimeframe: Timeframe): void => {
            if (!isTierHydrated) return;
            if (isFreeTier && nextTimeframe !== DEFAULT_TIMEFRAME) return;
            if (nextTimeframe === timeframe) return;
            // 이전 타임프레임 쿼리 취소 — 불필요한 네트워크 요청 방지
            void queryClient.cancelQueries({
                queryKey: QUERY_KEYS.barsPrefix(symbol, timeframe),
            });
            // 새 타임프레임 데이터를 이벤트 핸들러 시점에 prefetch한다.
            // useSuspenseQuery가 렌더 도중 Server Action을 호출하면
            // Next.js 내부 Router 상태 업데이트와 충돌하므로,
            // 렌더 전에 쿼리 캐시에 데이터(또는 진행 중인 Promise)를 넣어둔다.
            void queryClient.prefetchQuery({
                queryKey: QUERY_KEYS.bars(
                    symbol,
                    nextTimeframe,
                    assetInfo?.fmpSymbol
                ),
                queryFn: ({ queryKey: [, qSymbol, qTimeframe, qFmpSymbol] }) =>
                    getBarsAction(qSymbol, qTimeframe, qFmpSymbol),
            });
            startTransition(() => {
                setTimeframeChangeCount(c => c + 1);
                pendingNavigationRef.current = nextTimeframe;
                router.replace(
                    `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${nextTimeframe}`,
                    { scroll: false }
                );
            });
        },
        [
            timeframe,
            isFreeTier,
            isTierHydrated,
            queryClient,
            symbol,
            router,
            assetInfo?.fmpSymbol,
        ]
    );

    useEffect(() => {
        if (
            !isTierHydrated ||
            !isFreeTier ||
            tf === null ||
            tf === DEFAULT_TIMEFRAME
        ) {
            return;
        }

        router.replace(
            `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${DEFAULT_TIMEFRAME}`,
            {
                scroll: false,
            }
        );
    }, [isFreeTier, isTierHydrated, router, symbol, tf]);

    useEffect(() => {
        if (!isTierHydrated) return;
        if (timeframe === previousTimeframeRef.current) return;

        previousTimeframeRef.current = timeframe;
        if (pendingNavigationRef.current === timeframe) {
            pendingNavigationRef.current = null;
            return;
        }
        setTimeframeChangeCount(count => count + 1);
    }, [isTierHydrated, timeframe]);

    return { timeframe, timeframeChangeCount, handleTimeframeChange };
}
