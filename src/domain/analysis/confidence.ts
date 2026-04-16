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

    // LLM이 필드를 누락하거나 null로 반환할 수 있으므로 기본값으로 정규화한다.
    const patternSummaries = raw.patternSummaries ?? [];
    const strategyResults = raw.strategyResults ?? [];
    const candlePatterns = raw.candlePatterns ?? [];

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
        summary: raw.summary ?? '',
        trend: raw.trend ?? 'neutral',
        indicatorResults: raw.indicatorResults ?? [],
        riskLevel: raw.riskLevel ?? 'medium',
        keyLevels: {
            support: raw.keyLevels?.support ?? [],
            resistance: raw.keyLevels?.resistance ?? [],
            poc: raw.keyLevels?.poc ?? undefined,
        },
        priceTargets: {
            bullish: raw.priceTargets?.bullish ?? null,
            bearish: raw.priceTargets?.bearish ?? null,
        },
        trendlines: raw.trendlines ?? [],
        actionRecommendation: raw.actionRecommendation ?? undefined,
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
