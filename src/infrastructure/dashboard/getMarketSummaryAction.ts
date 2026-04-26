'use server';

import {
    getMarketSummaryWithBriefing,
    type MarketSummaryWithBriefing,
} from '@y0ngha/siglens-core';

export async function getMarketSummaryAction(): Promise<MarketSummaryWithBriefing> {
    return getMarketSummaryWithBriefing();
}
