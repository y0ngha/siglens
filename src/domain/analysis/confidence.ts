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
    analysis: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const lookup = buildSkillLookup(skills);
    const patternSummaryIds = buildUniqueIds(
        analysis.patternSummaries,
        'patternName'
    );
    const candlePatternIds = buildUniqueIds(
        analysis.candlePatterns,
        'patternName'
    );
    const strategyResultIds = buildUniqueIds(
        analysis.strategyResults,
        'strategyName'
    );

    const enrichedPatterns: PatternResult[] = analysis.patternSummaries.map(
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
        ...analysis,
        patternSummaries: filterPatterns(enrichedPatterns),
        strategyResults: analysis.strategyResults.map(
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
        candlePatterns: analysis.candlePatterns.map(
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
