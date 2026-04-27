'use server';

import { waitUntil } from '@vercel/functions';
import { pollAnalysis } from '@y0ngha/siglens-core';
import type { PollAnalysisResult } from '@y0ngha/siglens-core';

export async function pollAnalysisAction(
    jobId: string
): Promise<PollAnalysisResult> {
    return pollAnalysis(jobId, { waitUntil });
}
