'use server';

import {
    getReanalyzeCooldownMs as coreGetMs,
    releaseReanalyzeCooldown as coreRelease,
    tryAcquireReanalyzeCooldown as coreTryAcquire,
    type AcquireReanalyzeCooldownResult,
} from '@y0ngha/siglens-core';
import type { Timeframe } from '@/domain/types';

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

export async function releaseReanalyzeCooldown(
    symbol: string,
    timeframe: Timeframe
): Promise<void> {
    try {
        return await coreRelease(symbol, timeframe);
    } catch (error) {
        console.error('[ReanalyzeCooldown] release 실패:', error);
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
