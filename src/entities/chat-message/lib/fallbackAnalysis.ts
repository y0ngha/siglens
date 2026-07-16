import type { AnalysisResponse } from '@y0ngha/siglens-core';

/**
 * Empty AnalysisResponse used as a placeholder when no chart analysis is available
 * (e.g. server-side AI failure, or initial render before useAnalysis triggers). The
 * "AI 분석을 일시적으로 사용할 수 없습니다." summary is appropriate here because the
 * chart truly has no analysis yet. Components that consume this should check
 * `isAnalysisReady` to decide whether to enable user input.
 */
export const FALLBACK_ANALYSIS: AnalysisResponse = {
    summary: 'AI 분석을 일시적으로 사용할 수 없습니다.',
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

/**
 * `analysis`가 chart 페이지의 "AI 서사 없음" placeholder인지 판정한다.
 *
 * 참조 동등성만으로는 판정할 수 없다: SSR cache-miss 경로(`[symbol]/page.tsx`)가
 * `FALLBACK_ANALYSIS`를 `initialAnalysis`로 넘겨도, 그 prop은 `SymbolPageClient`의
 * `'use client'` 경계(RSC 직렬화)를 건너면서 값은 동일하지만 참조는 다른 객체로
 * 재구성된다(`ShareKindPanel`의 "props are serialized over the RSC boundary" 코멘트
 * 참고). 게다가 `useAnalysis`의 `normalizeAnalysisResponse`가 그 위에 `{ ...analysis }`
 * 스프레드를 한 번 더 씌워 참조를 재차 끊는다. 따라서 `=== FALLBACK_ANALYSIS`만으로는
 * 실제 프로덕션 경로(클라이언트가 받는 `analysis`)에서 단 한 번도 true가 되지 않는다.
 *
 * 그래서 참조 fast-path(같은 프로세스 내 직접 참조·테스트 등)를 유지하되, placeholder만
 * 갖는 고유한 값(sentinel summary 텍스트 + 모든 배열이 비어 있음)으로 값 기반 판정을
 * 추가한다. sentinel summary 텍스트는 이 파일에서만 정의되어 다른 실제 분석 결과와
 * 우연히 겹칠 수 없다.
 */
export function isFallbackAnalysis(analysis: AnalysisResponse): boolean {
    if (analysis === FALLBACK_ANALYSIS) return true;

    return (
        analysis.summary === FALLBACK_ANALYSIS.summary &&
        (analysis.indicatorResults?.length ?? 0) === 0 &&
        (analysis.patternSummaries?.length ?? 0) === 0 &&
        (analysis.strategyResults?.length ?? 0) === 0 &&
        (analysis.candlePatterns?.length ?? 0) === 0 &&
        (analysis.trendlines?.length ?? 0) === 0
    );
}

/**
 * Baseline AnalysisResponse passed to core's `requestChatCompletion` when the user
 * is on a non-chart page (fundamental / news / overall). Core's `buildChatPrompt`
 * unconditionally embeds the `analysis` parameter as the prompt's primary
 * "ANALYSIS DATA" block (trend, summary, key levels, indicators, etc.) — we cannot
 * suppress that section from the siglens side without a core API change.
 *
 * The mitigation is to make the embedded block self-deprecating: the `summary` field
 * (one of three high-signal lines surfaced by core's prompt template) explicitly
 * redirects the LLM to the `## Current analysis context` section, which carries the
 * real fundamental / news / overall payload via `currentAnalysisContext`.
 *
 * TODO(siglens-core): make `analysis` optional in `buildChatPrompt` / `ChatRequestParams`
 * when `currentAnalysisContext` is present, and skip the entire `=== ANALYSIS DATA ===`
 * block in that case. After that lands, this constant can be removed.
 */
export const CHAT_NON_CHART_BASELINE_ANALYSIS: AnalysisResponse = {
    summary:
        '(차트 분석 결과가 아닙니다. 사용자가 보고 있는 분석은 아래 ## Current analysis context 섹션을 참고하세요.)',
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
