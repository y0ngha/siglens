'use server';

/**
 * ⚠️ 이 파일의 export는 전부 **인증 없이 호출 가능한 서버 액션**이다.
 *
 * 그래서 쿨다운 `release`는 여기 두지 않는다 — 열어두면 "해제 → 재분석 요청"을
 * 반복해 쿨다운을 무력화할 수 있고, 그 쿨다운이 공개 SSE 라우트에서 캐시 우회
 * LLM 호출을 막는 유일한 장치다. 해제는 라우트가 서버 안에서 직접 한다
 * (`src/app/api/analysis/stream/route.ts`의 `releaseOnFailure`).
 */

import {
    getReanalyzeCooldownMs as coreGetMs,
    tryAcquireReanalyzeCooldown as coreTryAcquire,
    type AcquireReanalyzeCooldownResult,
} from '@y0ngha/siglens-core';
import type { Timeframe } from '@y0ngha/siglens-core';

export async function tryAcquireReanalyzeCooldown(
    symbol: string,
    timeframe: Timeframe
): Promise<AcquireReanalyzeCooldownResult> {
    try {
        return await coreTryAcquire(symbol, timeframe);
    } catch (error) {
        console.error('[ReanalyzeCooldown] acquire 실패:', error);
        return { ok: true };
    }
}

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
