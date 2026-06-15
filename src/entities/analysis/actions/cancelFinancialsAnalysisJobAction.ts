'use server';

import { cancelFinancialsAnalysisJob } from '@y0ngha/siglens-core';

/** Server Action: best-effort cancel for `jobId` from {@link submitFinancialsAnalysisAction}; errors are swallowed. */
export async function cancelFinancialsAnalysisJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelFinancialsAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelFinancialsAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
