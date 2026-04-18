'use server';

import { waitUntil } from '@vercel/functions';
import type { MarketBriefingResponse, PollBriefingResult } from '@/domain/types';
import { normalizeMarketBriefing } from '@/domain/analysis/normalizeMarketBriefing';
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

    const briefing: MarketBriefingResponse = normalizeMarketBriefing(raw);

    // 정규화 후 summary가 없으면 worker 응답 이상
    if (!briefing.summary) {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Invalid briefing result' };
    }

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
