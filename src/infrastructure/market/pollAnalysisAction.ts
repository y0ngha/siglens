'use server';

import { pollAnalysis } from '@y0ngha/siglens-core';
import type { PollAnalysisResult } from '@/domain/types';

export async function pollAnalysisAction(
    jobId: string
): Promise<PollAnalysisResult> {
    return pollAnalysis(jobId);
}
