'use server';

import {
    pollNewsAnalysis,
    type PollNewsAnalysisResult,
} from '@y0ngha/siglens-core';

/** Server Action: poll a previously submitted news analysis job; returns `processing`, `done`, or `error`. */
export async function pollNewsAnalysisAction(
    jobId: string
): Promise<PollNewsAnalysisResult> {
    return pollNewsAnalysis(jobId);
}
