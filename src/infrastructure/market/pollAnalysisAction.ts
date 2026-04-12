'use server';

import { waitUntil } from '@vercel/functions';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { RawAnalysisResponse, Skill, Timeframe } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    buildAnalysisCacheKey,
    ANALYSIS_CACHE_TTL,
} from '@/infrastructure/cache/config';
import { parseJsonResponse } from '@/infrastructure/ai/utils';
import {
    getJobStatus,
    getJobResult,
    getJobError,
    getJobMeta,
    cleanupJob,
} from '@/infrastructure/jobs/queue';
import type { PollAnalysisResult } from '@/infrastructure/jobs/types';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

export async function pollAnalysisAction(
    jobId: string
): Promise<PollAnalysisResult> {
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
    const [rawResult, meta] = await Promise.all([
        getJobResult(jobId),
        getJobMeta(jobId),
    ]);

    if (!rawResult) {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Result not found' };
    }

    const parsed = parseJsonResponse<RawAnalysisResponse>(
        rawResult,
        'Worker'
    );

    const skillsLoader = new FileSkillsLoader();
    let skills: Skill[] = [];
    let skillsDegraded = false;
    try {
        skills = await skillsLoader.loadSkills();
    } catch (error: unknown) {
        console.error('[Poll] Skills loading failed:', error);
        skillsDegraded = true;
    }

    const enriched = enrichAnalysisWithConfidence(parsed, skills);

    // 캐시 저장
    if (meta) {
        const cache = createCacheProvider();
        if (cache !== null) {
            const cacheKey = buildAnalysisCacheKey(
                meta.symbol,
                meta.timeframe
            );
            const ttl = ANALYSIS_CACHE_TTL[meta.timeframe];
            waitUntil(
                cache
                    .set(cacheKey, { ...enriched, skillsDegraded }, ttl)
                    .catch(error =>
                        console.error('[Poll] Cache write failed:', error)
                    )
            );
        }
    }

    waitUntil(cleanupJob(jobId));

    return { status: 'done', result: enriched, skillsDegraded };
}
