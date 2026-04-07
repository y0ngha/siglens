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

/**
 * 개발용 모의 분석 모드.
 *
 * `MOCK_ANALYSIS_DELAY_MS` 환경변수를 설정하면(예: 10000),
 *  - 실제 AI 호출(runAnalysis)을 건너뛰고
 *  - 캐시 읽기/쓰기를 모두 우회한 채
 *  - 지정된 지연 시간 이후 미니 모의 결과를 반환한다.
 *
 * "캐시가 없는 상태에서 AI가 빠르게 응답하는" 상황(AnalysisProgress의
 * 마무리 애니메이션 동작)을 로컬에서 재현하기 위한 테스트 스위치다.
 *
 * `.env.local`에 다음을 추가해 사용한다:
 *   MOCK_ANALYSIS_DELAY_MS=10000
 */
function getMockDelayMs(): number | null {
    const raw = process.env.MOCK_ANALYSIS_DELAY_MS;
    if (raw === undefined || raw === '') return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}

function buildMockResult(symbol: string): RunAnalysisResult {
    return {
        summary: `[MOCK] ${symbol} 모의 분석 결과입니다. MOCK_ANALYSIS_DELAY_MS가 설정되어 있어 실제 AI 호출을 건너뛰었습니다.`,
        trend: 'neutral',
        signals: [
            {
                type: 'RSI',
                direction: 'neutral',
                description: '모의 RSI 시그널 — 중립',
            },
            {
                type: 'MACD',
                direction: 'bullish',
                description: '모의 MACD 시그널 — 약한 매수',
            },
        ],
        skillSignals: [],
        riskLevel: 'medium',
        keyLevels: {
            support: [{ price: 100, reason: '모의 지지 레벨' }],
            resistance: [{ price: 120, reason: '모의 저항 레벨' }],
        },
        priceTargets: {
            bullish: { targets: [], condition: '' },
            bearish: { targets: [], condition: '' },
        },
        patternSummaries: [],
        skillResults: [],
        candlePatterns: [],
        trendlines: [],
    } as unknown as RunAnalysisResult;
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function analyzeAction(
    variables: AnalyzeVariables,
    timeframe: Timeframe,
    // force: 호출자가 "재분석"을 의도했음을 의미하지만, 다중 사용자 환경에서
    // 캐시를 무효화하면 사용자별로 결과가 어긋나고 마지막 호출자의 값으로 캐시가
    // 덮어써지는 문제가 있다. 정책이 정리될 때까지 force는 의도적으로 무시하고
    // 항상 캐시를 우선 반환한다. 시그니처는 호출부 호환을 위해 유지한다.
    _force: boolean = false
): Promise<RunAnalysisResult> {
    // 모의 모드: 캐시도 AI도 모두 우회한다. "캐시 없음 + 빠른 AI 응답" 시나리오 재현.
    const mockDelayMs = getMockDelayMs();
    if (mockDelayMs !== null) {
        console.log(
            `[MockAnalysis] ${variables.symbol}/${timeframe} — ${mockDelayMs}ms 후 모의 결과 반환`
        );
        await delay(mockDelayMs);
        return buildMockResult(variables.symbol);
    }

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

    console.log('[Analysis] Run Analysis:', cacheKey)
    const result = await runAnalysis(variables, timeframe);

    if (cache !== null) {
        cache
            .set(cacheKey, result, ANALYSIS_CACHE_TTL[timeframe])
            .catch(error => console.error('[Cache] 캐시 쓰기 실패:', error));
    }

    return result;
}
