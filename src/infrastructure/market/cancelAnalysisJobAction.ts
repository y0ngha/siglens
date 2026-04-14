'use server';

import { cancelJob } from '@/infrastructure/jobs/queue';

export async function cancelAnalysisJobAction(jobId: string): Promise<void> {
    try {
        await cancelJob(jobId);
    } catch (error) {
        // 취소는 fire-and-forget — Redis 장애 시 클라이언트 흐름을 막지 않는다.
        // 워커 작업은 TTL 만료 후 자연 정리된다.
        console.warn('[cancelAnalysisJobAction] Failed to signal cancellation:', jobId, error);
    }
}
