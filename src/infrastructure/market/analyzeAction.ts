'use server';

import { waitUntil } from '@vercel/functions';
import {
    runAnalysis,
    type RunAnalysisResult,
} from '@/infrastructure/market/analysisApi';
import type { Timeframe } from '@/domain/types';
import { fetchBarsWithIndicators } from '@/infrastructure/market/barsApi';
import { createCacheProvider } from '@/infrastructure/cache/redis';
import {
    buildAnalysisCacheKey,
    computeEffectiveTtl,
} from '@/infrastructure/cache/config';

/** @deprecated submitAnalysisAction + pollAnalysisAction으로 대체됨. 로컬 개발 폴백용으로만 유지. */
export async function analyzeAction(
    symbol: string,
    timeframe: Timeframe
): Promise<RunAnalysisResult> {
    const cache = createCacheProvider();
    const cacheKey = buildAnalysisCacheKey(symbol, timeframe);

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
    const { bars, indicators } = await fetchBarsWithIndicators(symbol, timeframe);
    const result = await runAnalysis({ symbol, bars, indicators }, timeframe);

    if (cache !== null) {
        waitUntil(
            cache
                .set(
                    cacheKey,
                    result,
                    computeEffectiveTtl(timeframe, new Date())
                )
                .catch(error => console.error('[Cache] 캐시 쓰기 실패:', error))
        );
    }

    return result;
}
