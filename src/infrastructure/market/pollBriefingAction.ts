'use server';

import { waitUntil } from '@vercel/functions';
import { pollBriefing } from '@y0ngha/siglens-core';
import type { PollBriefingResult } from '@y0ngha/siglens-core';

export async function pollBriefingAction(
    jobId: string
): Promise<PollBriefingResult> {
    return pollBriefing(jobId, { waitUntil });
}
