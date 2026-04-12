'use server';

import { waitUntil } from '@vercel/functions';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type {
    AnalyzeVariables,
    SubmitAnalysisResult,
    Timeframe,
} from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import { buildAnalysisCacheKey } from '@/infrastructure/cache/config';
import type { RunAnalysisResult } from '@/infrastructure/market/analysisApi';
import { setJobMeta } from '@/infrastructure/jobs/queue';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';

export async function submitAnalysisAction(
    variables: AnalyzeVariables,
    timeframe: Timeframe
): Promise<SubmitAnalysisResult> {
    const { symbol, bars, indicators } = variables;

    if (!symbol || !bars || bars.length === 0 || !indicators) {
        throw new Error('symbol, bars, and indicators are required');
    }

    // 1. 캐시 확인
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(symbol, timeframe);

    if (cache !== null) {
        try {
            const cached = await cache.get<RunAnalysisResult>(cacheKey);
            if (cached !== null) {
                console.log('[Submit] Cache hit:', cacheKey);
                return {
                    status: 'cached',
                    result: cached,
                    skillsDegraded: cached.skillsDegraded,
                };
            }
        } catch (error) {
            console.error('[Submit] Cache read failed:', error);
        }
    }

    // 2. Skills 로딩 + 프롬프트 빌드
    const skillsLoader = new FileSkillsLoader();
    const skills = await skillsLoader.loadSkills().catch((error: unknown) => {
        console.error('[Submit] Skills loading failed:', error);
        return [];
    });

    const prompt = buildAnalysisPrompt(
        symbol,
        bars,
        indicators,
        skills,
        timeframe
    );

    // 3. jobId 생성 + 메타 저장
    const jobId = crypto.randomUUID();
    await setJobMeta(jobId, { symbol, timeframe });

    // 4. Worker에 fire-and-forget
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;
    if (!workerUrl || !workerSecret) {
        throw new Error(
            'WORKER_URL and WORKER_SECRET environment variables are required'
        );
    }

    waitUntil(
        fetch(`${workerUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Worker-Secret': workerSecret,
            },
            body: JSON.stringify({ jobId, prompt }),
        }).catch(error => {
            console.error('[Submit] Worker request failed:', error);
        })
    );

    console.log('[Submit] Job submitted:', jobId, cacheKey);
    return { status: 'submitted', jobId };
}
