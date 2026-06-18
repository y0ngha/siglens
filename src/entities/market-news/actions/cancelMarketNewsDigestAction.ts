'use server';

import { cancelNewsAnalysisJob } from '@y0ngha/siglens-core';

/**
 * Server Action: best-effort cancel for `jobId` from {@link submitMarketNewsDigestAction};
 * errors are swallowed so a failed cancel never propagates to the client.
 */
export async function cancelMarketNewsDigestAction(
    jobId: string
): Promise<void> {
    try {
        return await cancelNewsAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelMarketNewsDigestAction] cancel failed:',
            jobId,
            error
        );
    }
}
