'use server';

import type { MarketSummaryActionResult } from '@/shared/lib/types';
import { isBot } from '@/shared/api/isBot';
import { submitBriefing } from '@y0ngha/siglens-core';
import { headers } from 'next/headers';
import { getMarketDataProvider } from '@/shared/api/market/getMarketDataProvider';
import { isE2E } from '@/shared/api/e2eEnv';
import { getCachedMarketSummary } from '../lib/marketSummaryCache';

export async function getMarketSummaryAction(): Promise<MarketSummaryActionResult> {
    try {
        const requestHeaders = await headers();
        const provider = getMarketDataProvider();
        const summary = await getCachedMarketSummary(provider);

        if (isBot(requestHeaders)) {
            return { summary, briefing: null, botBlocked: true };
        }

        if (isE2E()) {
            return { summary, briefing: null, botBlocked: false };
        }

        let briefing = null;
        try {
            briefing = await submitBriefing(summary);
        } catch (briefingError) {
            console.error(
                '[getMarketSummaryAction] briefing submission failed:',
                briefingError
            );
        }
        return { summary, briefing, botBlocked: false };
    } catch (e) {
        console.error('[getMarketSummaryAction] failed:', e);
        return { ok: false, error: 'server_error' };
    }
}
