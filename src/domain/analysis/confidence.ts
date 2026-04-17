import {
    MIN_CONFIDENCE_WEIGHT,
    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';
import type {
    AnalysisResponse,
    CandlePatternSummary,
    PatternResult,
    PatternSummary,
    RawAnalysisResponse,
    Skill,
    StrategyResult,
} from '@/domain/types';
import {
    asArray,
    asString,
    compact,
    normalizeActionRecommendation,
    normalizeCandlePatternSummary,
    normalizeIndicatorGuideResult,
    normalizeKeyLevels,
    normalizePatternSummary,
    normalizePriceTargets,
    normalizeRiskLevel,
    normalizeStrategyResult,
    normalizeTrend,
    normalizeTrendline,
} from '@/domain/analysis/normalize';

interface SkillLookup {
    byName: Map<string, Skill>;
    byPattern: Map<string, Skill>;
}

function buildSkillLookup(skills: Skill[]): SkillLookup {
    const byName = new Map(skills.map(s => [s.name, s]));
    const byPattern = new Map(
        skills
            .filter((s): s is Skill & { pattern: string } => Boolean(s.pattern))
            .map(s => [s.pattern, s])
    );
    return { byName, byPattern };
}

function findSkill(lookup: SkillLookup, skillName: string): Skill | undefined {
    return lookup.byName.get(skillName) ?? lookup.byPattern.get(skillName);
}

function buildUniqueIds<T, K extends keyof T>(items: T[], key: K): string[] {
    return items.reduce<{ ids: string[]; counter: Map<string, number> }>(
        ({ ids, counter }, item) => {
            const name = String(item[key]);
            const count = counter.get(name) ?? 0;
            return {
                ids: [...ids, `${name}_${count}`],
                counter: new Map(counter).set(name, count + 1),
            };
        },
        { ids: [], counter: new Map() }
    ).ids;
}

export function filterPatterns(patterns: PatternResult[]): PatternResult[] {
    return patterns.filter(p => MIN_CONFIDENCE_WEIGHT <= p.confidenceWeight);
}

export function enrichAnalysisWithConfidence(
    raw: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const lookup = buildSkillLookup(skills);

    // 모든 배열 필드를 타입 검증하며 정규화한다.
    // 잘못된 항목(null 반환)은 탈락시킨다.
    const patternSummaries = compact(
        asArray(raw.patternSummaries).map(normalizePatternSummary)
    );
    const strategyResults = compact(
        asArray(raw.strategyResults).map(normalizeStrategyResult)
    );
    const candlePatterns = compact(
        asArray(raw.candlePatterns).map(normalizeCandlePatternSummary)
    );
    const indicatorResults = compact(
        asArray(raw.indicatorResults).map(normalizeIndicatorGuideResult)
    );
    const trendlines = compact(asArray(raw.trendlines).map(normalizeTrendline));

    const patternSummaryIds = buildUniqueIds(patternSummaries, 'patternName');
    const candlePatternIds = buildUniqueIds(candlePatterns, 'patternName');
    const strategyResultIds = buildUniqueIds(strategyResults, 'strategyName');

    const enrichedPatterns: PatternResult[] = patternSummaries.map(
        (
            p: Omit<PatternSummary, 'confidenceWeight' | 'id'>,
            index: number
        ): PatternResult => {
            const skill = findSkill(lookup, p.skillName);
            return {
                ...p,
                id: patternSummaryIds[index],
                confidenceWeight:
                    skill?.confidenceWeight ??
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
                renderConfig: skill?.display?.chart,
            };
        }
    );

    return {
        summary: asString(raw.summary),
        trend: normalizeTrend(raw.trend),
        indicatorResults,
        riskLevel: normalizeRiskLevel(raw.riskLevel),
        keyLevels: normalizeKeyLevels(raw.keyLevels),
        priceTargets: normalizePriceTargets(raw.priceTargets),
        trendlines,
        actionRecommendation: normalizeActionRecommendation(
            raw.actionRecommendation
        ),
        patternSummaries: filterPatterns(enrichedPatterns),
        strategyResults: strategyResults.map(
            (
                r: Omit<StrategyResult, 'confidenceWeight' | 'id'>,
                index: number
            ): StrategyResult => ({
                ...r,
                id: strategyResultIds[index],
                confidenceWeight:
                    findSkill(lookup, r.strategyName)?.confidenceWeight ??
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
            })
        ),
        candlePatterns: candlePatterns.map(
            (
                p: Omit<CandlePatternSummary, 'id'>,
                index: number
            ): CandlePatternSummary => ({
                ...p,
                id: candlePatternIds[index],
            })
        ),
    };
}
