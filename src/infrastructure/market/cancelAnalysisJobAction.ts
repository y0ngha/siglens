'use server';

import { cancelAnalysisJob } from '@y0ngha/siglens-core';

export async function cancelAnalysisJobAction(jobId: string): Promise<void> {
    return cancelAnalysisJob(jobId);
}
