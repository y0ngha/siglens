import { createJobRedis } from '@/infrastructure/jobs/redis';
import type { JobMeta, JobStatus } from '@/infrastructure/jobs/types';
import { SECONDS_PER_HOUR } from '@/domain/constants/time';

const JOB_TTL_SECONDS = SECONDS_PER_HOUR;

// Upstash Redis는 HTTP REST 기반이므로 클라이언트 인스턴스 생성 비용이 없다.
// TCP 연결을 유지하지 않으므로 함수마다 호출해도 성능 영향이 없다.

function statusKey(jobId: string): string {
    return `job:${jobId}:status`;
}

function resultKey(jobId: string): string {
    return `job:${jobId}:result`;
}

function errorKey(jobId: string): string {
    return `job:${jobId}:error`;
}

function metaKey(jobId: string): string {
    return `job:${jobId}:meta`;
}

export async function setJobMeta(jobId: string, meta: JobMeta): Promise<void> {
    const redis = createJobRedis();
    if (!redis) return;
    await redis.set(metaKey(jobId), JSON.stringify(meta), {
        ex: JOB_TTL_SECONDS,
    });
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
    const redis = createJobRedis();
    if (!redis) return null;
    return redis.get<JobStatus>(statusKey(jobId));
}

// Upstash REST client는 JSON 문자열을 자동 파싱하여 객체로 반환할 수 있다
export async function getJobResult(jobId: string): Promise<unknown> {
    const redis = createJobRedis();
    if (!redis) return null;
    return redis.get(resultKey(jobId));
}

export async function getJobError(jobId: string): Promise<string | null> {
    const redis = createJobRedis();
    if (!redis) return null;
    return redis.get<string>(errorKey(jobId));
}

export async function getJobMeta(jobId: string): Promise<JobMeta | null> {
    const redis = createJobRedis();
    if (!redis) return null;
    const raw = await redis.get<string>(metaKey(jobId));
    if (!raw) return null;
    try {
        // Redis stores meta as JSON string; shape is guaranteed by setJobMeta
        return JSON.parse(raw) as JobMeta;
    } catch {
        return null;
    }
}

export async function cleanupJob(jobId: string): Promise<void> {
    const redis = createJobRedis();
    if (!redis) return;
    await redis.del(
        statusKey(jobId),
        resultKey(jobId),
        errorKey(jobId),
        metaKey(jobId)
    );
}
