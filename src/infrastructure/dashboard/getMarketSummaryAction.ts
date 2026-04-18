'use server';

import { getMarketSummary } from './marketSummaryApi';
import { submitBriefingAction } from '@/infrastructure/market/submitBriefingAction';
import type { MarketSummaryActionResult } from '@/domain/types';

export async function getMarketSummaryAction(): Promise<MarketSummaryActionResult> {
    const summary = await getMarketSummary();
    const briefing = await submitBriefingAction(summary);
    return { summary, briefing };
}
