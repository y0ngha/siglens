'use server';

import { cancelFundamentalAnalysisJob } from '@y0ngha/siglens-core';

/** Server Action: best-effort cancel for `jobId` from {@link submitFundamentalAnalysisAction}; errors are swallowed. */
export async function cancelFundamentalAnalysisJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelFundamentalAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelFundamentalAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
