'use server';

import {
    type PollOverallAnalysisResult,
    type Tier,
    pollOverallAnalysis,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';

/** Server Action: poll a previously submitted overall analysis job; returns `processing`, `done`, or `error`. */
export async function pollOverallAnalysisAction(
    jobId: string
): Promise<PollOverallAnalysisResult> {
    let tier: Tier;
    try {
        const user = await getCurrentUser();
        tier = await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        console.error(
            '[pollOverallAnalysisAction] Failed to resolve caller tier:',
            error
        );
        try {
            return await pollOverallAnalysis(jobId, { tier: 'free' });
        } catch (fallbackError) {
            console.error(
                '[pollOverallAnalysisAction] Failed to poll with free fallback:',
                fallbackError
            );
            return {
                status: 'error',
                error: 'Overall analysis poll is temporarily unavailable.',
            };
        }
    }

    try {
        return await pollOverallAnalysis(jobId, { tier });
    } catch (error) {
        console.error(
            '[pollOverallAnalysisAction] Failed to poll overall analysis:',
            error
        );
        return {
            status: 'error',
            error: 'Overall analysis poll is temporarily unavailable.',
        };
    }
}
