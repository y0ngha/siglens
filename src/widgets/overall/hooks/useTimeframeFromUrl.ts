'use client';

import { useSearchParams } from 'next/navigation';
import type { Timeframe } from '@y0ngha/siglens-core';
import { DEFAULT_TIMEFRAME, isValidTimeframe } from '@/shared/config/market';

/**
 * URL의 `tf` 쿼리에서 timeframe을 읽어 검증한다. 서버가 아닌 **client**에서 읽어야
 * `[symbol]` 라우트가 ISR(정적 렌더) 가능하게 유지된다(서버 searchParams 읽기는 동적 렌더 강제).
 * 유효하지 않거나 없으면 `DEFAULT_TIMEFRAME`. 호출부가 timeframe을 파생 변수가 아니라
 * 훅 반환값으로 받게 해 MISTAKES.md §17(훅 선언이 파생 변수보다 앞) 준수를 돕는다.
 */
export function useTimeframeFromUrl(): Timeframe {
    const tfParam = useSearchParams().get('tf');
    return isValidTimeframe(tfParam) ? tfParam : DEFAULT_TIMEFRAME;
}
