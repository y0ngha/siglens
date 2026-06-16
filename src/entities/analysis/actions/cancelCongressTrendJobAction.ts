'use server';

import { cancelCongressTrendJob } from '@y0ngha/siglens-core';

/** Server Action: best-effort cancel for `jobId` from {@link submitCongressTrendAction}; errors are swallowed. */
export async function cancelCongressTrendJobAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelCongressTrendJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelCongressTrendJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
