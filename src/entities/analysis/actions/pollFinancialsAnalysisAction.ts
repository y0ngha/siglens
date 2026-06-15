'use server';

import {
    pollFinancialsAnalysis,
    type PollFinancialsAnalysisResult,
} from '@y0ngha/siglens-core';

/**
 * Server Action: poll the result of a financials analysis job. Returns
 * `processing`, `done`, or `error`.
 *
 * §0.7: Server Actions must never propagate exceptions to the client. An
 * unexpected throw (Redis/transport failure) is caught and surfaced as a typed
 * `error` result — the polling loop in `useFinancialsAnalysis` already treats
 * `status: 'error'` as a terminal failure.
 */
export async function pollFinancialsAnalysisAction(
    jobId: string
): Promise<PollFinancialsAnalysisResult> {
    try {
        return await pollFinancialsAnalysis(jobId);
    } catch (error) {
        console.error(
            '[pollFinancialsAnalysisAction] poll failed:',
            jobId,
            error
        );
        return { status: 'error', error: '분석 결과를 가져오지 못했습니다.' };
    }
}
