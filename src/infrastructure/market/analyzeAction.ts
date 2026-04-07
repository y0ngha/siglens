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
    // force: 호출자가 "재분석"을 의도했음을 의미하지만, 다중 사용자 환경에서
    // 캐시를 무효화하면 사용자별로 결과가 어긋나고 마지막 호출자의 값으로 캐시가
    // 덮어써지는 문제가 있다. 정책이 정리될 때까지 force는 의도적으로 무시하고
    // 항상 캐시를 우선 반환한다. 시그니처는 호출부 호환을 위해 유지한다.
    _force: boolean = false
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
        cache
            .set(cacheKey, result, ANALYSIS_CACHE_TTL[timeframe])
            .catch(error => console.error('[Cache] 캐시 쓰기 실패:', error));
    }

    return result;
}
