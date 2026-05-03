'use server';

import {
    pollFundamentalAnalysis,
    type PollFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';

/** Server Action: poll the result of a fundamental analysis job. Returns `processing`, `done`, or `error`. */
export async function pollFundamentalAnalysisAction(
    jobId: string
): Promise<PollFundamentalAnalysisResult> {
    return pollFundamentalAnalysis(jobId);
}
