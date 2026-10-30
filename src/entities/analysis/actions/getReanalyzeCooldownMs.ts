'use server';

/**
 * ⚠️ 인증 없이 호출 가능한 서버 액션이다. 쿨다운 `release`를 두지 않는 이유는
 * `tryAcquireReanalyzeCooldown.ts` 헤더를 본다.
 */

import { getReanalyzeCooldownMs as coreGetMs } from '@y0ngha/siglens-core';
import type { Timeframe } from '@y0ngha/siglens-core';

/** 남은 재분석 쿨다운(ms). 조회 장애는 기록하고 `0`(쿨다운 없음)으로 본다. */
export async function getReanalyzeCooldownMs(
    symbol: string,
    timeframe: Timeframe
): Promise<number> {
    try {
        return await coreGetMs(symbol, timeframe);
    } catch (error) {
        console.error('[ReanalyzeCooldown] pttl 조회 실패:', error);
        return 0;
    }
}
