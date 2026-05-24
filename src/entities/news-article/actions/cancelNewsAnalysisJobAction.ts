'use server';

import { cancelNewsAnalysisJob } from '@y0ngha/siglens-core';

/** Server Action: best-effort cancel for `jobId` from {@link submitNewsAnalysisAction}; errors are swallowed. */
export async function cancelNewsAnalysisJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelNewsAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelNewsAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
