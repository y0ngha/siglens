'use server';

import { submitBriefing } from '@y0ngha/siglens-core';
import type { MarketSummaryData, SubmitBriefingResult } from '@/domain/types';

export async function submitBriefingAction(
    data: MarketSummaryData
): Promise<SubmitBriefingResult> {
    return submitBriefing(data);
}
