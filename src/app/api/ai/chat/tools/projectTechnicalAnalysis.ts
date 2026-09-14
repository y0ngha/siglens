import 'server-only';
import type {
    AnalysisResponse,
    FilteredAnalysisResponse,
    KeyLevels,
    PriceTargets,
    RiskLevel,
    Trend,
} from '@y0ngha/siglens-core';
import { fitProse, type ProseSpec } from './fitProse';

/**
 * Both the Redis peek path (`getCachedAnalysis.ts`, tier-filtered — arrays may
 * be `null` for a locked info-depth fragment) and the fresh-analysis path
 * (`runFreshAnalysis.ts`, always the full `AnalysisResponse`) feed this
 * projection, so it must tolerate either shape.
 */
type ProjectableAnalysis = AnalysisResponse | FilteredAnalysisResponse;

/** One capped, confidence-sorted entry of `ProjectedTechnicalAnalysis['patterns']`. */
export interface ProjectedPatternSummary {
    name: string;
    trend: Trend;
    confidence: number;
    summary: string;
}

/** One capped entry of `ProjectedTechnicalAnalysis['candlePatterns']` (the AI analysis's own candle-pattern verdicts — distinct from `BarCandlePattern` in `getBarsIndicators.ts`, which is raw bar-level pattern detection). */
export interface ProjectedCandlePatternSummary {
    name: string;
    trend: Trend;
    summary: string;
}

/** One capped, confidence-sorted entry of `ProjectedTechnicalAnalysis['strategies']`. */
export interface ProjectedStrategySummary {
    name: string;
    trend: Trend;
    summary: string;
}

/**
 * Return shape of `projectTechnicalAnalysis`. `summary`/`trend`/`riskLevel`/
 * `keyLevels`/`priceTargets` are nullable because a `FilteredAnalysisResponse`
 * (tier-locked fragment) carries `null` for a locked field — this projection
 * passes that through unchanged rather than inventing a placeholder.
 */
export type ProjectedTechnicalAnalysis = {
    summary: string | null;
    trend: Trend | null;
    riskLevel: RiskLevel | null;
    keyLevels: KeyLevels | null;
    priceTargets: PriceTargets | null;
    actionRecommendation: NonNullable<
        ProjectableAnalysis['actionRecommendation']
    > | null;
    patterns: ProjectedPatternSummary[];
    candlePatterns: ProjectedCandlePatternSummary[];
    strategies: ProjectedStrategySummary[];
};

/** The model reads a handful of top signals — no reason to ship every skill verdict. */
const MAX_PATTERNS = 5;
/** Caps the AI analysis's own `candlePatterns` verdicts — distinct from `MAX_BAR_CANDLE_PATTERNS` in `getBarsIndicators.ts`, which caps raw bar-level pattern detection. */
const MAX_ANALYSIS_CANDLE_PATTERNS = 5;
const MAX_STRATEGIES = 5;

/**
 * Projects a technical `AnalysisResponse` (or its tier-filtered variant) to
 * the shape both `get_cached_analysis` and `run_fresh_analysis` return, so
 * the model sees one consistent shape regardless of which tool produced it.
 *
 * Drops `indicatorResults` and `trendlines` — the bulk of the payload and
 * never needed by the model, which only reads the summarized verdict. Keeps
 * a capped, confidence-sorted slice of `patternSummaries`/`strategyResults`/
 * `candlePatterns` so the model can answer "is there a head-and-shoulders?"
 * without the prose summary having to mention it.
 */
export function projectTechnicalAnalysis(
    a: ProjectableAnalysis
): ProjectedTechnicalAnalysis {
    return {
        summary: a.summary,
        trend: a.trend,
        riskLevel: a.riskLevel,
        keyLevels: a.keyLevels,
        priceTargets: a.priceTargets,
        actionRecommendation: a.actionRecommendation ?? null,
        patterns: (a.patternSummaries ?? [])
            .filter(p => p.detected === true)
            .toSorted((x, y) => y.confidenceWeight - x.confidenceWeight)
            .slice(0, MAX_PATTERNS)
            .map(p => ({
                name: p.patternName,
                trend: p.trend,
                confidence: p.confidenceWeight,
                summary: p.summary,
            })),
        candlePatterns: (a.candlePatterns ?? [])
            .filter(p => p.detected === true)
            .slice(0, MAX_ANALYSIS_CANDLE_PATTERNS)
            .map(p => ({
                name: p.patternName,
                trend: p.trend,
                summary: p.summary,
            })),
        strategies: (a.strategyResults ?? [])
            .toSorted((x, y) => y.confidenceWeight - x.confidenceWeight)
            .slice(0, MAX_STRATEGIES)
            .map(s => ({
                name: s.strategyName,
                trend: s.trend,
                summary: s.summary,
            })),
    };
}

/**
 * The `fitProse` field spec for a `projectTechnicalAnalysis` result —
 * `summary` is free-form prose; `patterns`/`candlePatterns`/`strategies`
 * are variable-length lists (already capped, but a realistic analysis can
 * still carry enough Korean prose per entry to overflow the budget).
 * `keyLevels`, `priceTargets` and `actionRecommendation` are bounded
 * structured objects (numbers + a handful of short fields) and are left
 * untouched by the fit.
 */
function technicalProseSpec(
    projected: ProjectedTechnicalAnalysis
): Record<string, ProseSpec> {
    return {
        summary: { kind: 'text', value: projected.summary },
        patterns: { kind: 'list', value: projected.patterns },
        candlePatterns: { kind: 'list', value: projected.candlePatterns },
        strategies: { kind: 'list', value: projected.strategies },
    };
}

/**
 * Fits an already-assembled technical-analysis envelope's `analysis` leaf
 * (a `projectTechnicalAnalysis` result) to `CACHED_ANALYSIS_MAX_CHARS`.
 *
 * Shared by `get_cached_analysis` (Redis peek path) and `run_fresh_analysis`
 * so an oversized technical projection is protected IDENTICALLY regardless
 * of which tool produced it. Before this helper existed, only the fresh
 * path ran `fitProse` — the Redis path returned `projectTechnicalAnalysis`
 * unfitted, so an oversized `patterns`/`candlePatterns`/`strategies` slice
 * would fall through to the registry-level `truncateToolResult`, which
 * collapses the WHOLE payload into a front-cut preview blob (losing
 * `keyLevels`/`priceTargets` too, not just the oversized field).
 *
 * `envelope` must already carry the final `analysis` (unfitted) — the
 * overflow is measured against the FULL envelope (tab/source/timeframe/etc.
 * included), matching what the registry will actually serialize.
 */
export function fitTechnicalAnalysis<
    T extends { analysis: ProjectedTechnicalAnalysis },
>(envelope: T): T {
    const fitted = fitProse(envelope, technicalProseSpec(envelope.analysis));
    return { ...envelope, analysis: { ...envelope.analysis, ...fitted } };
}
