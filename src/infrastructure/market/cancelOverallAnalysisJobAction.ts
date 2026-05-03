'use server';

import { cancelOverallAnalysisJob } from '@y0ngha/siglens-core';

/** Server Action: best-effort cancel for `jobId` from {@link submitOverallAnalysisAction}; errors are swallowed. */
export async function cancelOverallAnalysisJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelOverallAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelOverallAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
