'use server';

import {
    pollNewsAnalysis,
    type PollNewsAnalysisResult,
} from '@y0ngha/siglens-core';

/**
 * Server Action: poll the result of a previously submitted news analysis job.
 *
 * @param jobId - Job identifier returned by {@link submitNewsAnalysisAction}.
 * @returns Current job state — `processing`, `done`, or `error`.
 */
export async function pollNewsAnalysisAction(
    jobId: string
): Promise<PollNewsAnalysisResult> {
    return pollNewsAnalysis(jobId);
}
