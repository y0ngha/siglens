'use server';

import {
    pollFinancialsAnalysis,
    type PollFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';

/** Server Action: poll the result of a financials analysis job. Returns `processing`, `done`, or `error`. */
export async function pollFinancialsAnalysisAction(
    jobId: string
): Promise<PollFinancialsAnalysisResult> {
    return pollFinancialsAnalysis(jobId);
}
