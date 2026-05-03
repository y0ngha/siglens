'use server';

import {
    pollOverallAnalysis,
    type PollOverallAnalysisResult,
} from '@y0ngha/siglens-core';

/**
 * Server Action: poll the result of a previously submitted overall analysis job.
 *
 * @param jobId - Job identifier returned by {@link submitOverallAnalysisAction}.
 * @returns Current job state — `processing`, `done`, or `error`.
 */
export async function pollOverallAnalysisAction(
    jobId: string
): Promise<PollOverallAnalysisResult> {
    return pollOverallAnalysis(jobId);
}
