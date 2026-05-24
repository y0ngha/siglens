'use server';

import { waitUntil } from '@vercel/functions';
import { type PollBriefingResult, pollBriefing } from '@y0ngha/siglens-core';

export async function pollBriefingAction(
    jobId: string
): Promise<PollBriefingResult> {
    return pollBriefing(jobId, { waitUntil });
}
