'use server';

import {
    pollFundamentalAnalysis,
    type PollFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';

/**
 * Server Action: poll the result of a previously submitted fundamental analysis job.
 *
 * @param jobId - Job identifier returned by {@link submitFundamentalAnalysisAction}.
 * @returns Current job state — `processing`, `done`, or `error`.
 */
export async function pollFundamentalAnalysisAction(
    jobId: string
): Promise<PollFundamentalAnalysisResult> {
    return pollFundamentalAnalysis(jobId);
}
