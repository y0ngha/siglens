'use server';

import { headers } from 'next/headers';
import { submitMacroBriefing } from '@y0ngha/siglens-core';

import { isBot } from '@/shared/api/isBot';
import type { MacroBriefingActionResult } from '@/shared/lib/types';

import { getEconomySnapshot } from '../api/economySnapshotCache';

/**
 * /economy 거시 브리핑 클라 트리거 — `submitMarketBriefingAction` 미러.
 *
 * 봇이면 즉시 차단(잡 미제출, 비용 0). 아니면 캐시된 EconomySnapshot을 입력으로
 * core `submitMacroBriefing`에 위임(redis HIT 시 cached, miss 시 jobId).
 */
export async function submitMacroBriefingAction(): Promise<MacroBriefingActionResult> {
    try {
        const requestHeaders = await headers();
        if (isBot(requestHeaders)) {
            return { briefing: null, botBlocked: true };
        }
        const snapshot = await getEconomySnapshot();
        const briefing = await submitMacroBriefing(snapshot);
        return { briefing, botBlocked: false };
    } catch (e) {
        console.error('[submitMacroBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
