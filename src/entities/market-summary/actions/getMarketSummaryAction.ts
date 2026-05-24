'use server';

import type { MarketSummaryActionResult } from '@/domain/types';
import { isBot } from '@/shared/api/isBot';
import {
    getMarketSummary,
    getMarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';

export async function getMarketSummaryAction(): Promise<MarketSummaryActionResult> {
    try {
        const requestHeaders = await headers();

        if (isBot(requestHeaders)) {
            const summary = await getMarketSummary();
            return { summary, briefing: null, botBlocked: true };
        }

        const result = await getMarketSummaryWithBriefing();
        return { ...result, botBlocked: false };
    } catch (e) {
        console.error('[getMarketSummaryAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
