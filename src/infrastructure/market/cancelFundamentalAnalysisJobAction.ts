'use server';

import { cancelFundamentalAnalysisJob } from '@y0ngha/siglens-core';

/**
 * Server Action: send a cancellation signal for an in-flight fundamental analysis job.
 *
 * Errors are swallowed — cancellation is best-effort and the caller does not
 * need to handle failure.
 *
 * @param jobId - Job identifier returned by {@link submitFundamentalAnalysisAction}.
 */
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
