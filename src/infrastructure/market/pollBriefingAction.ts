'use server';

import { waitUntil } from '@vercel/functions';
import type { PollBriefingResult } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    buildBriefingCacheKey,
    MARKET_BRIEFING_CACHE_TTL,
    ISO_DATE_HOUR_PREFIX_LENGTH,
} from '@/infrastructure/cache/config';
import {
    getJobStatus,
    getJobResult,
    getJobError,
    cleanupJob,
} from '@/infrastructure/jobs/queue';

export async function pollBriefingAction(
    jobId: string
): Promise<PollBriefingResult> {
    const status = await getJobStatus(jobId);

    if (status === null || status === 'processing') {
        return { status: 'processing' };
    }

    if (status === 'error') {
        const error = await getJobError(jobId);
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: error ?? 'Unknown error' };
    }

    // status === 'done'
    const raw = await getJobResult(jobId);
    if (!raw) {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Result not found' };
    }

    // worker가 저장하는 결과는 항상 { briefing: string } 형태이므로 assertion이 안전하다
    const briefing = (raw as { briefing?: string }).briefing; // worker 계약에 의해 보장
    if (!briefing) {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Invalid briefing result' };
    }

    // 브리핑을 캐시에 저장 (1시간 TTL)
    const now = new Date();
    const generatedAt = now.toISOString();
    const dateHour = generatedAt.slice(0, ISO_DATE_HOUR_PREFIX_LENGTH);
    const cacheKey = buildBriefingCacheKey(dateHour);
    const cache = createCacheProvider();
    if (cache !== null) {
        waitUntil(
            cache
                .set(
                    cacheKey,
                    { briefing, generatedAt },
                    MARKET_BRIEFING_CACHE_TTL
                )
                .catch(err =>
                    console.error('[Briefing/Poll] Cache write failed:', err)
                )
        );
    }

    waitUntil(cleanupJob(jobId));
    return { status: 'done', briefing, generatedAt };
}
