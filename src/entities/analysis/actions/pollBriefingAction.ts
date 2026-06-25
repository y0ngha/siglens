'use server';

import { type PollBriefingResult, pollBriefing } from '@y0ngha/siglens-core';

export async function pollBriefingAction(
    jobId: string
): Promise<PollBriefingResult> {
    return pollBriefing(jobId);
}
