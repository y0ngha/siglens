import type { AnalysisResponse, KeyLevels } from '@y0ngha/siglens-core';

/**
 * `AnalysisResponse`의 모든 필드를 required로 선언하지만, 실제 응답은
 * `@y0ngha/siglens-core`의 부분 객체(누락된 배열/객체)일 수 있다 — LLM 정규화
 * 누락, 구버전 캐시, 부분 직렬화 등. 정적 타입과 런타임이 어긋나면 패널의
 * `analysis.trendlines.map(...)` 같은 무방비 접근이 렌더 중 throw한다.
 *
 * 이 헬퍼는 누락된 배열/객체 필드를 빈 기본값으로 채워 타입 계약을 런타임에서
 * 다시 보장한다. 잘 형성된 응답은 그대로 통과하므로 정상 렌더링 동작은 변하지
 * 않는다(필드 값을 덮어쓰지 않고 누락 시에만 기본값을 채운다).
 *
 * 데이터 소스(useAnalysis)에서 1회 적용해 배열/객체 계약을 복원한다. 단,
 * AnalysisPanel·buildExpertAnalysisReport는 정규화되지 않은 부분 응답을 직접
 * 받을 수도 있으므로 각자 독립적인 `?? []` 방어 기본값을 유지한다(방어 심층화).
 */
const EMPTY_KEY_LEVELS: KeyLevels = {
    support: [],
    resistance: [],
};

export function normalizeAnalysisResponse(
    analysis: AnalysisResponse
): AnalysisResponse {
    // `AnalysisResponse` types keyLevels as required, but an LLM partial response
    // can omit it at runtime — widen to optional so the null/undefined guard below
    // is reachable (the whole point of this normalizer).
    const rawKeyLevels = analysis.keyLevels as KeyLevels | undefined;
    const keyLevels: KeyLevels =
        rawKeyLevels === undefined || rawKeyLevels === null
            ? EMPTY_KEY_LEVELS
            : {
                  support: rawKeyLevels.support ?? [],
                  resistance: rawKeyLevels.resistance ?? [],
                  poc: rawKeyLevels.poc,
              };

    return {
        ...analysis,
        indicatorResults: analysis.indicatorResults ?? [],
        patternSummaries: analysis.patternSummaries ?? [],
        strategyResults: analysis.strategyResults ?? [],
        candlePatterns: analysis.candlePatterns ?? [],
        trendlines: analysis.trendlines ?? [],
        keyLevels,
        priceTargets: analysis.priceTargets ?? { bullish: null, bearish: null },
    };
}
