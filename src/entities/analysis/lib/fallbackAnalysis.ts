import type { AnalysisResponse } from '@y0ngha/siglens-core';

/**
 * Empty AnalysisResponse used as a placeholder when no chart analysis is available
 * (e.g. server-side AI failure, or initial render before useAnalysis triggers).
 * Components that consume this should check `isAnalysisReady` to decide whether
 * to enable user input.
 *
 * 상수가 아니라 빌더인 이유: `summary`가 화면에 그대로 나가는 문구라 요청
 * 로케일이 필요하다. 예전에는 한국어 리터럴이라 `/en/AAPL`이 분석 실패 시
 * 영어 화면에 한국어 요약을 렌더했다.
 *
 * 번역자가 아니라 **완성된 문구**를 받는다. 이 모듈은 `isFallbackAnalysis`를
 * 통해 클라이언트 번들에도 들어가는데, 번역자를 인자로 받으면서 그 안에서
 * `t('리터럴')`을 부르면 추출기가 파일을 통째로 건너뛰어 그 키가 클라이언트
 * 페이로드에서 빠진다(§noTranslatorParamCall.test.ts).
 *
 * @param summary `entities.analysis.fallback.unavailable`의 로케일 문구.
 */
export function buildFallbackAnalysis(summary: string): AnalysisResponse {
    return {
        summary,
        trend: 'neutral',
        indicatorResults: [],
        riskLevel: 'medium',
        keyLevels: { support: [], resistance: [] },
        priceTargets: {
            bullish: { targets: [], condition: '' },
            bearish: { targets: [], condition: '' },
        },
        patternSummaries: [],
        strategyResults: [],
        candlePatterns: [],
        trendlines: [],
    };
}

/**
 * `analysis`가 chart 페이지의 "AI 서사 없음" placeholder인지 판정한다.
 *
 * 참조 동등성만으로는 판정할 수 없다: SSR cache-miss 경로(`[symbol]/page.tsx`)가
 * 폴백을 `initialAnalysis`로 넘겨도, 그 prop은 `SymbolPageClient`의
 * `'use client'` 경계(RSC 직렬화)를 건너면서 값은 동일하지만 참조는 다른 객체로
 * 재구성된다(`ShareKindPanel`의 "props are serialized over the RSC boundary" 코멘트
 * 참고). 게다가 `useAnalysis`의 `normalizeAnalysisResponse`가 그 위에 `{ ...analysis }`
 * 스프레드를 한 번 더 씌워 참조를 재차 끊는다. 따라서 참조 비교만으로는 실제
 * 프로덕션 경로에서 단 한 번도 true가 되지 않는다.
 *
 * sentinel은 `summary` 문자열이다. 폴백 문구가 로케일별로 갈리면서 모듈이
 * 혼자 알 수 없게 됐으므로 **호출부가 그 로케일의 폴백 summary를 넘긴다** —
 * 배열이 비어 있다는 조건만으로는 free-tier 필터로 배열이 비워진 응답
 * (summary가 `''`이거나 실제 서사)까지 폴백으로 오인한다.
 *
 * @param fallbackSummary `buildFallbackAnalysis`에 넘긴 것과 **같은 번역자**의
 *                        `unavailable` 문구.
 */
export function isFallbackAnalysis(
    analysis: AnalysisResponse,
    fallbackSummary: string
): boolean {
    return (
        analysis.summary === fallbackSummary &&
        (analysis.indicatorResults?.length ?? 0) === 0 &&
        (analysis.patternSummaries?.length ?? 0) === 0 &&
        (analysis.strategyResults?.length ?? 0) === 0 &&
        (analysis.candlePatterns?.length ?? 0) === 0 &&
        (analysis.trendlines?.length ?? 0) === 0
    );
}
