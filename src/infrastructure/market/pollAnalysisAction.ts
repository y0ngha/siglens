'use server';

import { waitUntil } from '@vercel/functions';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { PollAnalysisResult, RawAnalysisResponse } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    buildAnalysisCacheKey,
    computeEffectiveTtl,
} from '@/infrastructure/cache/config';
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

    // Upstash get()은 자동 역직렬화된 객체를 반환한다.
    // RawAnalysisResponse 필수 필드로 최소 검증한다.
    const parsed = rawResult as RawAnalysisResponse;
    if (!parsed.summary || !parsed.trend || !parsed.riskLevel) {
        waitUntil(cleanupJob(jobId));
        return { status: 'error', error: 'Invalid response from worker' };
    }

    const skillsLoader = new FileSkillsLoader();
    let skills: Awaited<ReturnType<typeof skillsLoader.loadSkills>> = [];
    try {
        skills = await skillsLoader.loadSkills();
    } catch (error) {
        console.error(
            '[Poll] Skills loading failed, proceeding without skills:',
            error
        );
    }
    const skillsDegraded = meta?.skillsDegraded ?? false;

    const enriched = enrichAnalysisWithConfidence(parsed, skills);

    // 캐시 저장 (RunAnalysisResult 형식: AnalysisResponse + skillsDegraded)
    if (meta) {
        const cache = createCacheProvider();
        if (cache !== null) {
            const cacheKey = buildAnalysisCacheKey(meta.symbol, meta.timeframe);
            const ttl = computeEffectiveTtl(meta.timeframe, new Date());
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
