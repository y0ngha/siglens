'use server';

import { waitUntil } from '@vercel/functions';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import { postProcessAnalysisWithReconcile } from '@/domain/analysis/ai-levels';
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
        console.error('[Poll] Result not found', {
            jobId,
            rawResultType: typeof rawResult,
            rawResultValue: rawResult,
            hasMeta: meta !== null,
            symbol: meta?.symbol,
            timeframe: meta?.timeframe,
        });
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

    // AI SL/TP 검증 + ATR 기반 fallback + 텍스트 재조합.
    // meta.lastClose/atr은 submitAnalysisAction이 저장한 값 (fallback 계산 기준).
    // 값이 없으면 reconcile은 no-op — 원본 AI 응답 유지.
    const reconciled = postProcessAnalysisWithReconcile(
        enriched,
        meta?.lastClose,
        meta?.atr
    );

    const analyzedAt = new Date().toISOString();
    const result = { ...reconciled, analyzedAt };

    // 캐시 저장 (RunAnalysisResult 형식: AnalysisResponse + skillsDegraded)
    if (meta) {
        const cache = createCacheProvider();
        if (cache !== null) {
            const cacheKey = buildAnalysisCacheKey(meta.symbol, meta.timeframe);
            const ttl = computeEffectiveTtl(meta.timeframe, new Date());
            waitUntil(
                cache
                    .set(cacheKey, { ...result, skillsDegraded }, ttl)
                    .catch(error =>
                        console.error('[Poll] Cache write failed:', error)
                    )
            );
        }
    }

    waitUntil(cleanupJob(jobId));

    return { status: 'done', result };
}
