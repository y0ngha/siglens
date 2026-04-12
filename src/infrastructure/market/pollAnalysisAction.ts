'use server';

import { waitUntil } from '@vercel/functions';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type {
    PollAnalysisResult,
    RawAnalysisResponse,
    Skill,
} from '@/domain/types';
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

    let parsed: RawAnalysisResponse;
    try {
        parsed = parseJsonResponse<RawAnalysisResponse>(rawResult, 'Worker');
    } catch {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Invalid response from worker' };
    }

    const skillsLoader = new FileSkillsLoader();
    let skills: Skill[] = [];
    let pollSkillsDegraded = false;
    try {
        skills = await skillsLoader.loadSkills();
    } catch (error: unknown) {
        console.error('[Poll] Skills loading failed:', error);
        pollSkillsDegraded = true;
    }

    // submit 단계의 skills 저하 OR poll 단계의 skills 저하
    const skillsDegraded = (meta?.skillsDegraded ?? false) || pollSkillsDegraded;

    const enriched = enrichAnalysisWithConfidence(parsed, skills);

    // 캐시 저장 (RunAnalysisResult 형식: AnalysisResponse + skillsDegraded)
    if (meta) {
        const cache = createCacheProvider();
        if (cache !== null) {
            const cacheKey = buildAnalysisCacheKey(meta.symbol, meta.timeframe);
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

    return { status: 'done', result: enriched };
}
