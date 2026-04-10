'use server';

import { waitUntil } from '@vercel/functions';
import {
    runAnalysis,
    type RunAnalysisResult,
} from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables, Timeframe } from '@/domain/types';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    buildAnalysisCacheKey,
    ANALYSIS_CACHE_TTL,
} from '@/infrastructure/cache/config';

export async function analyzeAction(
    variables: AnalyzeVariables,
    timeframe: Timeframe
): Promise<RunAnalysisResult> {
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(variables.symbol, timeframe);

    if (cache !== null) {
        try {
            const cached = await cache.get<RunAnalysisResult>(cacheKey);
            console.log('[Cache] Has Cached:', cached !== null, cacheKey);
            if (cached !== null) {
                return cached;
            }
        } catch (error) {
            console.error('[Cache] 캐시 읽기 실패:', error);
        }
    }

    console.log('[Analysis] Run Analysis:', cacheKey);
    const result = await runAnalysis(variables, timeframe);

    if (cache !== null) {
        waitUntil(
            cache
                .set(cacheKey, result, ANALYSIS_CACHE_TTL[timeframe])
                .catch(error => console.error('[Cache] 캐시 쓰기 실패:', error))
        );
    }

    return result;
}
