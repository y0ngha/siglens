'use server';

import { pollBriefing } from '@y0ngha/siglens-core';
import type { PollBriefingResult } from '@/domain/types';

export async function pollBriefingAction(
    jobId: string
): Promise<PollBriefingResult> {
    return pollBriefing(jobId);
}
