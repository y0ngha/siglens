'use server';

import { waitUntil } from '@vercel/functions';
import { type PollAnalysisResult, pollAnalysis } from '@y0ngha/siglens-core';

export async function pollAnalysisAction(
    jobId: string
): Promise<PollAnalysisResult> {
    return pollAnalysis(jobId, { waitUntil });
}
