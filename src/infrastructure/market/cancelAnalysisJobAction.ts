'use server';

import { cancelJob } from '@/infrastructure/jobs/queue';

export async function cancelAnalysisJobAction(jobId: string): Promise<void> {
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;

    const tasks: Promise<unknown>[] = [cancelJob(jobId)];

    // 워커가 설정된 경우 /cancel 엔드포인트에도 신호를 보내 진행 중인 AI 호출을 즉시 중단한다.
    if (workerUrl && workerSecret) {
        tasks.push(
            fetch(`${workerUrl}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Worker-Secret': workerSecret,
                },
                body: JSON.stringify({ jobId }),
            })
        );
    }

    // 취소는 fire-and-forget — Redis 장애나 워커 에러 시 클라이언트 흐름을 막지 않는다.
    // 워커 작업은 TTL 만료 후 자연 정리된다.
    const results = await Promise.allSettled(tasks);
    for (const result of results) {
        if (result.status === 'rejected') {
            console.warn(
                '[cancelAnalysisJobAction] Failed to signal cancellation:',
                jobId,
                result.reason
            );
        }
    }
}
