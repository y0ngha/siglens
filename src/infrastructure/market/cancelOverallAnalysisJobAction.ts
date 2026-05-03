'use server';

import { cancelOverallAnalysisJob } from '@y0ngha/siglens-core';

/**
 * Server Action: send a cancellation signal for an in-flight overall analysis job.
 *
 * Errors are swallowed — cancellation is best-effort and the caller does not
 * need to handle failure.
 *
 * @param jobId - Job identifier returned by {@link submitOverallAnalysisAction}.
 */
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
