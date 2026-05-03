'use server';

import {
    pollOverallAnalysis,
    type PollOverallAnalysisResult,
} from '@y0ngha/siglens-core';

/** Server Action: poll a previously submitted overall analysis job; returns `processing`, `done`, or `error`. */
export async function pollOverallAnalysisAction(
    jobId: string
): Promise<PollOverallAnalysisResult> {
    return pollOverallAnalysis(jobId);
}
