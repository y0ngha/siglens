import type {
    AnalysisResponse,
    FilteredAnalysisResponse,
    KeyLevels,
} from '@y0ngha/siglens-core';

const EMPTY_KEY_LEVELS: KeyLevels = {
    support: [],
    resistance: [],
};

/**
 * `AnalysisResponse`의 모든 필드를 required로 선언하지만, 실제 응답은
 * `@y0ngha/siglens-core`의 부분 객체(누락된 배열/객체)일 수 있다 — LLM 정규화
 * 누락, 구버전 캐시, 부분 직렬화 등. 정적 타입과 런타임이 어긋나면 패널의
 * `analysis.trendlines.map(...)` 같은 무방비 접근이 렌더 중 throw한다.
 *
 * 누락된 배열/객체 필드를 빈 기본값으로 채워 타입 계약을 런타임에서 다시 보장한다.
 * 잘 형성된 응답은 그대로 통과하므로 정상 렌더링 동작은 변하지 않는다(필드 값을
 * 덮어쓰지 않고 누락 시에만 기본값을 채운다).
 *
 * 데이터 소스(`useAnalysis`)에서 1회 적용해 배열/객체 계약을 복원한다. 단,
 * AnalysisPanel·buildExpertAnalysisReport는 정규화되지 않은 부분 응답을 직접 받을
 * 수도 있으므로 각자 독립적인 `?? []` 방어 기본값을 유지한다(방어 심층화).
 */
export function normalizeAnalysisResponse(
    analysis: AnalysisResponse | FilteredAnalysisResponse
): AnalysisResponse {
    // safe: 타입은 keyLevels를 required로 두지만 LLM 부분 응답은 런타임에 생략할 수
    // 있다 — 아래 null/undefined 가드가 도달 가능하도록 optional로 넓힌다.
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
        summary: analysis.summary ?? '',
        trend: analysis.trend ?? 'neutral',
        indicatorResults: analysis.indicatorResults ?? [],
        riskLevel: analysis.riskLevel ?? 'medium',
        patternSummaries: analysis.patternSummaries ?? [],
        strategyResults: analysis.strategyResults ?? [],
        candlePatterns: analysis.candlePatterns ?? [],
        trendlines: analysis.trendlines ?? [],
        keyLevels,
        priceTargets: analysis.priceTargets ?? { bullish: null, bearish: null },
        // safe: 스프레드는 (부분일 수 있는) 입력의 모든 필드를 싣고, `AnalysisResponse`가
        // 요구하는 필드(summary/trend/indicatorResults/riskLevel/patternSummaries/
        // strategyResults/candlePatterns/trendlines/keyLevels/priceTargets)는 위에서
        // 모두 기본값을 채웠다. TS가 부분 입력의 스프레드를 required 타입으로 스스로
        // 좁히지 못할 뿐이다.
    } as AnalysisResponse;
}
