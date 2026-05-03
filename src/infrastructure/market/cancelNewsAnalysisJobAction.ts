'use server';

import { cancelNewsAnalysisJob } from '@y0ngha/siglens-core';

/**
 * Server Action: send a cancellation signal for an in-flight news analysis job.
 *
 * Errors are swallowed — cancellation is best-effort and the caller does not
 * need to handle failure.
 *
 * @param jobId - Job identifier returned by {@link submitNewsAnalysisAction}.
 */
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
