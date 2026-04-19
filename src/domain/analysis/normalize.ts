import type {
    ActionRecommendation,
    AnalysisSignal,
    CandlePatternSummary,
    EntryRecommendation,
    IndicatorGuideResult,
    KeyLevel,
    KeyLevels,
    KeyPrice,
    PatternLine,
    PatternSummary,
    PriceScenario,
    PriceTarget,
    PriceTargets,
    RiskLevel,
    SignalStrength,
    StrategyResult,
    Trend,
    Trendline,
    TrendlineDirection,
    TrendlinePoint,
} from '@/domain/types';
import {
    asArray,
    asBoolean,
    asEnum,
    asNumber,
    asObject,
    asOptionalEnum,
    asString,
    compact,
} from './normalizePrimitives';

const VALID_TRENDS: readonly Trend[] = ['bullish', 'bearish', 'neutral'];
const VALID_RISK_LEVELS: readonly RiskLevel[] = ['low', 'medium', 'high'];
const VALID_TRENDLINE_DIRECTIONS: readonly TrendlineDirection[] = [
    'ascending',
    'descending',
];
const VALID_SIGNAL_STRENGTHS: readonly SignalStrength[] = [
    'strong',
    'moderate',
    'weak',
];
const VALID_ENTRY_RECOMMENDATIONS: readonly EntryRecommendation[] = [
    'enter',
    'wait',
    'avoid',
];

function normalizeNumberArray(v: unknown): number[] | undefined {
    if (!Array.isArray(v)) return undefined;
    return v.map(asNumber).filter((p): p is number => p !== undefined);
}

// --- enum 래퍼 ---

export function normalizeTrend(v: unknown): Trend {
    return asEnum(v, VALID_TRENDS, 'neutral');
}

export function normalizeRiskLevel(v: unknown): RiskLevel {
    return asEnum(v, VALID_RISK_LEVELS, 'medium');
}

// --- KeyLevel ---

export function normalizeKeyLevel(v: unknown): KeyLevel | null {
    const o = asObject(v);
    if (!o) return null;
    const price = asNumber(o.price);
    if (price === undefined) return null;
    return { price, reason: asString(o.reason) };
}

export function normalizeKeyLevels(v: unknown): KeyLevels {
    const o = asObject(v);
    if (!o) return { support: [], resistance: [], poc: undefined };
    return {
        support: compact(asArray(o.support).map(normalizeKeyLevel)),
        resistance: compact(asArray(o.resistance).map(normalizeKeyLevel)),
        poc: normalizeKeyLevel(o.poc) ?? undefined,
    };
}

// --- PriceTargets ---

export function normalizePriceTarget(v: unknown): PriceTarget | null {
    const o = asObject(v);
    if (!o) return null;
    const price = asNumber(o.price);
    if (price === undefined) return null;
    return { price, basis: asString(o.basis) };
}

export function normalizePriceScenario(v: unknown): PriceScenario | null {
    const o = asObject(v);
    if (!o) return null;
    return {
        targets: compact(asArray(o.targets).map(normalizePriceTarget)),
        condition: asString(o.condition),
    };
}

export function normalizePriceTargets(v: unknown): PriceTargets {
    const o = asObject(v);
    if (!o) return { bullish: null, bearish: null };
    return {
        bullish: normalizePriceScenario(o.bullish),
        bearish: normalizePriceScenario(o.bearish),
    };
}

// --- Signals / IndicatorGuideResult ---

export function normalizeSignal(v: unknown): AnalysisSignal | null {
    const o = asObject(v);
    if (!o) return null;
    // AnalysisSignalType은 현재 'skill' 단일 값으로 고정
    return {
        type: 'skill',
        description: asString(o.description),
        trend: normalizeTrend(o.trend),
        strength: asOptionalEnum(o.strength, VALID_SIGNAL_STRENGTHS),
    };
}

export function normalizeIndicatorGuideResult(
    v: unknown
): IndicatorGuideResult | null {
    const o = asObject(v);
    if (!o) return null;
    const indicatorName = asString(o.indicatorName);
    if (!indicatorName) return null;
    return {
        indicatorName,
        signals: compact(asArray(o.signals).map(normalizeSignal)),
    };
}

// --- Pattern / Strategy / Candle ---

export function normalizeKeyPrice(v: unknown): KeyPrice | null {
    const o = asObject(v);
    if (!o) return null;
    const price = asNumber(o.price);
    if (price === undefined) return null;
    return { label: asString(o.label), price };
}

export function normalizeTrendlinePoint(v: unknown): TrendlinePoint | null {
    const o = asObject(v);
    if (!o) return null;
    const time = asNumber(o.time);
    const price = asNumber(o.price);
    if (time === undefined || price === undefined) return null;
    return { time, price };
}

export function normalizePatternLine(v: unknown): PatternLine | null {
    const o = asObject(v);
    if (!o) return null;
    const start = normalizeTrendlinePoint(o.start);
    const end = normalizeTrendlinePoint(o.end);
    if (!start || !end) return null;
    return { label: asString(o.label), start, end };
}

export function normalizeTimeRange(
    v: unknown
): { start: number; end: number } | undefined {
    const o = asObject(v);
    if (!o) return undefined;
    const start = asNumber(o.start);
    const end = asNumber(o.end);
    if (start === undefined || end === undefined) return undefined;
    return { start, end };
}

export type RawPatternSummary = Omit<PatternSummary, 'confidenceWeight' | 'id'>;

export function normalizePatternSummary(v: unknown): RawPatternSummary | null {
    const o = asObject(v);
    if (!o) return null;
    const patternName = asString(o.patternName);
    const skillName = asString(o.skillName);
    if (!patternName || !skillName) return null;

    const keyPricesArr = Array.isArray(o.keyPrices)
        ? compact(o.keyPrices.map(normalizeKeyPrice))
        : undefined;
    const patternLinesArr = Array.isArray(o.patternLines)
        ? compact(o.patternLines.map(normalizePatternLine))
        : undefined;

    return {
        patternName,
        skillName,
        detected: asBoolean(o.detected),
        trend: normalizeTrend(o.trend),
        summary: asString(o.summary),
        keyPrices: keyPricesArr,
        patternLines: patternLinesArr,
        timeRange: normalizeTimeRange(o.timeRange),
    };
}

export type RawStrategyResult = Omit<StrategyResult, 'confidenceWeight' | 'id'>;

export function normalizeStrategyResult(v: unknown): RawStrategyResult | null {
    const o = asObject(v);
    if (!o) return null;
    const strategyName = asString(o.strategyName);
    if (!strategyName) return null;
    return {
        strategyName,
        trend: normalizeTrend(o.trend),
        summary: asString(o.summary),
    };
}

type RawCandlePatternSummary = Omit<CandlePatternSummary, 'id'>;

export function normalizeCandlePatternSummary(
    v: unknown
): RawCandlePatternSummary | null {
    const o = asObject(v);
    if (!o) return null;
    const patternName = asString(o.patternName);
    if (!patternName) return null;
    return {
        patternName,
        detected: asBoolean(o.detected),
        trend: normalizeTrend(o.trend),
        summary: asString(o.summary),
    };
}

// --- Trendline ---

export function normalizeTrendline(v: unknown): Trendline | null {
    const o = asObject(v);
    if (!o) return null;
    const direction = asOptionalEnum(o.direction, VALID_TRENDLINE_DIRECTIONS);
    const start = normalizeTrendlinePoint(o.start);
    const end = normalizeTrendlinePoint(o.end);
    if (!direction || !start || !end) return null;
    return { direction, start, end };
}

// --- ActionRecommendation ---

export function normalizeActionRecommendation(
    raw: unknown
): ActionRecommendation | undefined {
    const o = asObject(raw);
    if (!o) return undefined;

    const positionAnalysis = asString(o.positionAnalysis);
    const entry = asString(o.entry);
    const exit = asString(o.exit);
    const riskReward = asString(o.riskReward);

    // LLM이 텍스트 설명 없이 숫자 필드만 반환하는 케이스는 프롬프트 구조상 발생하지
    // 않으므로, 텍스트 4개 필드를 추천 존재 여부의 대표 신호로 사용한다.
    // 모두 비어 있으면 숫자 필드가 있더라도 추천 자체가 없는 것으로 간주한다.
    if (!positionAnalysis && !entry && !exit && !riskReward) return undefined;

    return {
        positionAnalysis,
        entry,
        exit,
        riskReward,
        entryRecommendation: asOptionalEnum(
            o.entryRecommendation,
            VALID_ENTRY_RECOMMENDATIONS
        ),
        entryPrices: normalizeNumberArray(o.entryPrices),
        stopLoss: asNumber(o.stopLoss),
        takeProfitPrices: normalizeNumberArray(o.takeProfitPrices),
    };
}
