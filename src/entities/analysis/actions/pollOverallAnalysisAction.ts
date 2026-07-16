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
    // 해석 실패 시 free로 fail-closed 처리한다. 상위 tier로 오인해 잠긴
    // 상세를 노출하는 것보다, 실제로는 회원인 호출자가 일시적으로 free
    // 취급되는 편이 안전하다.
    let tier: Tier = 'free';
    try {
        const user = await getCurrentUser();
        tier = await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        console.error(
            '[pollOverallAnalysisAction] Failed to resolve caller tier:',
            error
        );
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
