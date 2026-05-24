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
