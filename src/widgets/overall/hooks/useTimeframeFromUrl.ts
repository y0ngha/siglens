'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Timeframe } from '@y0ngha/siglens-core';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';

/**
 * URL의 `tf` 쿼리에서 timeframe을 읽어 검증한다. 서버가 아닌 **client**에서 읽어야
 * `[symbol]` 라우트가 ISR(정적 렌더) 가능하게 유지된다(서버 searchParams 읽기는 동적 렌더 강제).
 * 유효하지 않거나 없으면 `DEFAULT_TIMEFRAME`. 호출부가 timeframe을 파생 변수가 아니라
 * 훅 반환값으로 받게 해 MISTAKES.md §17(훅 선언이 파생 변수보다 앞) 준수를 돕는다.
 */
export function useTimeframeFromUrl(
    symbol: string,
    isFreeTier: boolean,
    isTierHydrated: boolean
): Timeframe {
    const tfParam = useSearchParams().get('tf');
    const requestedTimeframe = isValidTimeframe(tfParam)
        ? tfParam
        : DEFAULT_TIMEFRAME;
    const timeframe =
        (!isTierHydrated || isFreeTier) &&
        requestedTimeframe !== DEFAULT_TIMEFRAME
            ? DEFAULT_TIMEFRAME
            : requestedTimeframe;

    useEffect(() => {
        if (
            !isTierHydrated ||
            !isFreeTier ||
            tfParam === null ||
            tfParam === DEFAULT_TIMEFRAME
        ) {
            return;
        }

        // router.replace는 라우터 내비게이션을 유발해 이미 렌더된 화면이 다시 그려진다
        // (잘못된 tf가 잠깐 보이는 깜빡임의 원인). 반환값 timeframe은 이미 위에서
        // DEFAULT로 강제됐으므로 여기서는 주소만 맞춰 주면 된다 — Next가 공식 지원하는
        // history.replaceState로 내비게이션 없이 쿼리만 교체한다(useSearchParams에 반영됨).
        window.history.replaceState(
            null,
            '',
            `/${symbol}/overall?tf=${DEFAULT_TIMEFRAME}`
        );
    }, [isFreeTier, isTierHydrated, symbol, tfParam]);

    return timeframe;
}
