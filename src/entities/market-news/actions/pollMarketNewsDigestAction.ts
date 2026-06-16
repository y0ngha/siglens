'use server';

import {
    pollMarketNewsDigest,
    type PollMarketNewsDigestResult,
} from '@y0ngha/siglens-core';

/** Server Action: poll a previously submitted category digest job; returns `processing`, `done`, or `error`. */
export async function pollMarketNewsDigestAction(
    jobId: string
): Promise<PollMarketNewsDigestResult> {
    return pollMarketNewsDigest(jobId);
}
