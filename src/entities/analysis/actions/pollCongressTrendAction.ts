'use server';

import {
    pollCongressTrend,
    type PollCongressTrendResult,
} from '@y0ngha/siglens-core';

/**
 * Server Action: poll the result of a congress trend analysis job. Returns
 * `processing`, `done`, or `error`.
 *
 * §0.7: Server Actions must never propagate exceptions to the client. An
 * unexpected throw (Redis/transport failure) is caught and surfaced as a typed
 * `error` result — the polling loop in `useCongressTrend` already treats
 * `status: 'error'` as a terminal failure.
 */
export async function pollCongressTrendAction(
    jobId: string
): Promise<PollCongressTrendResult> {
    try {
        return await pollCongressTrend(jobId);
    } catch (error) {
        console.error('[pollCongressTrendAction] poll failed:', jobId, error);
        return { status: 'error', error: '동향 해석을 가져오지 못했습니다.' };
    }
}
