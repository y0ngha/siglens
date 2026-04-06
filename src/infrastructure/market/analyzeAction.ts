'use server';

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
    timeframe: Timeframe,
    force: boolean = false
): Promise<RunAnalysisResult> {
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(variables.symbol, timeframe);

    if (cache !== null) {
        if (force) {
            try {
                await cache.delete(cacheKey);
            } catch (error) {
                console.error('[Cache] 캐시 삭제 실패:', error);
            }
        } else {
            try {
                const cached = await cache.get<RunAnalysisResult>(cacheKey);
                if (cached !== null) {
                    return cached;
                }
            } catch (error) {
                console.error('[Cache] 캐시 읽기 실패:', error);
            }
        }
    }

    const result = await runAnalysis(variables, timeframe);

    if (cache !== null) {
        cache
            .set(cacheKey, result, ANALYSIS_CACHE_TTL[timeframe])
            .catch(error => console.error('[Cache] 캐시 쓰기 실패:', error));
    }

    return result;
}
