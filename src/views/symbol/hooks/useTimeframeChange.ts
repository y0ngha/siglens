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
    const pendingNavigationRef = useRef<Timeframe | null>(null);

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
    // previousTimeframeRef의 초기값은 파생 변수 timeframe에 의존하므로, 훅
    // 선언 순서 예외(MISTAKES.md #17)로 timeframe 계산 직후에 둔다.
    const previousTimeframeRef = useRef<Timeframe>(timeframe);

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

        // free tier의 intraday 딥링크를 daily로 캐노니컬라이즈하는 순수 URL 보정이다.
        // SSR page.tsx는 PPR을 static으로 유지하려고 tf를 읽지 않고(useSearchParams
        // 회피), 파생 timeframe도 free 호출자에게는 이미 DEFAULT_TIMEFRAME을 강제하므로
        // 서버에서 다시 가져올 데이터가 없다. router.replace()는 불필요한 RSC 왕복을
        // 유발할 뿐 아니라, 이 마운트 시점 effect에서 호출되면 초기 렌더·suspense
        // 폭풍과 겹쳐 navigation transition이 인터럽트되며 history 커밋이 조용히
        // 드롭된다(약 절반 확률). 그러면 tf가 intraday로 남지만 effect의 의존성은
        // 변하지 않아 재시도되지 않고, e2e waitForURL이 60s 타임아웃한다. 대신
        // window.history.replaceState는 URL을 동기적으로 바꾸고 Next가 useSearchParams와
        // 동기화하므로(공식 검색 파라미터 갱신 패턴) 캐노니컬라이즈가 결정적으로 완료된다.
        window.history.replaceState(
            null,
            '',
            `/${symbol}?${TIMEFRAME_QUERY_PARAM}=${DEFAULT_TIMEFRAME}`
        );
    }, [isFreeTier, isTierHydrated, symbol, tf]);

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
