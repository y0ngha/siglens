'use server';

import { cancelAnalysisJob } from '@y0ngha/siglens-core';

export async function cancelAnalysisJobAction(jobId: string): Promise<void> {
    try {
        return await cancelAnalysisJob(jobId);
    } catch (error) {
        console.warn(
            '[cancelAnalysisJobAction] 취소 신호 전송 실패:',
            jobId,
            error
        );
    }
}
