'use server';

import {
    type PollAnalysisResult,
    type Tier,
    pollAnalysis,
} from '@y0ngha/siglens-core';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { resolveTierOnly } from '@/shared/lib/byokGate';

export async function pollAnalysisAction(
    jobId: string
): Promise<PollAnalysisResult> {
    let tier: Tier;
    try {
        const user = await getCurrentUser();
        tier = await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        console.error(
            '[pollAnalysisAction] Failed to resolve caller tier:',
            error
        );
        try {
            return await pollAnalysis(jobId, { tier: 'free' });
        } catch (fallbackError) {
            console.error(
                '[pollAnalysisAction] Failed to poll with free fallback:',
                fallbackError
            );
            return {
                status: 'error',
                error: 'Analysis poll is temporarily unavailable.',
            };
        }
    }

    return pollAnalysis(jobId, { tier });
}
