'use server';

import type { MarketBriefingActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { submitBriefing } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

/**
 * briefing 클라 트리거. 봇이면 차단(job 미제출), 아니면 submitBriefing(내부에서
 * summary 재조회 — redis HIT). cached/submitted 결과를 반환. headers()는 클라 호출
 * 경로라 ISR과 무관.
 */
export async function submitMarketBriefingAction(): Promise<MarketBriefingActionResult> {
    try {
        const requestHeaders = await headers();
        if (isBot(requestHeaders)) {
            return { briefing: null, botBlocked: true };
        }
        const summary = await getCachedMarketSummary(getMarketDataProvider());
        const briefing = await submitBriefing(summary);
        return { briefing, botBlocked: false };
    } catch (e) {
        console.error('[submitMarketBriefingAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
