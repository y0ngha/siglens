'use server';

import { waitUntil } from '@vercel/functions';
import { submitBriefing } from '@y0ngha/siglens-core';
import type {
    MarketSummaryData,
    SubmitBriefingResult,
} from '@y0ngha/siglens-core';

export async function submitBriefingAction(
    data: MarketSummaryData
): Promise<SubmitBriefingResult> {
    return submitBriefing(data, { waitUntil });
}
