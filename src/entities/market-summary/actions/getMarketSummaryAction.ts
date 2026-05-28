'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import {
    getMarketSummary,
    getMarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';

export async function getMarketSummaryAction(): Promise<MarketSummaryActionResult> {
    try {
        const requestHeaders = await headers();
        const provider = getMarketDataProvider();

        if (isBot(requestHeaders)) {
            const summary = await getMarketSummary(provider);
            return { summary, briefing: null, botBlocked: true };
        }

        const result = await getMarketSummaryWithBriefing(provider);
        return { ...result, botBlocked: false };
    } catch (e) {
        console.error('[getMarketSummaryAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
