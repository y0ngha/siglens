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
    // 해석 실패 시 free로 fail-closed 처리한다. 상위 tier로 오인해 잠긴
    // 상세를 노출하는 것보다, 실제로는 회원인 호출자가 일시적으로 free
    // 취급되는 편이 안전하다.
    let tier: Tier = 'free';
    try {
        const user = await getCurrentUser();
        tier = await resolveTierOnly(user?.id ?? null);
    } catch (error) {
        console.error(
            '[pollAnalysisAction] Failed to resolve caller tier:',
            error
        );
    }

    try {
        return await pollAnalysis(jobId, { tier });
    } catch (error) {
        console.error('[pollAnalysisAction] Failed to poll analysis:', error);
        return {
            status: 'error',
            error: 'Analysis poll is temporarily unavailable.',
        };
    }
}
