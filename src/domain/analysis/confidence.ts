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
    SkillResult,
} from '@/domain/types';

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
    return patterns.filter(p => p.confidenceWeight >= MIN_CONFIDENCE_WEIGHT);
}

export function enrichAnalysisWithConfidence(
    analysis: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const skillByName = new Map(skills.map(s => [s.name, s]));
    const patternSummaryIds = buildUniqueIds(
        analysis.patternSummaries,
        'patternName'
    );
    const candlePatternIds = buildUniqueIds(
        analysis.candlePatterns,
        'patternName'
    );
    const skillResultIds = buildUniqueIds(analysis.skillResults, 'skillName');
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map(
            (
                p: Omit<PatternSummary, 'confidenceWeight' | 'id'>,
                index: number
            ): PatternResult => {
                const skill = skillByName.get(p.skillName);
                return {
                    ...p,
                    id: patternSummaryIds[index],
                    confidenceWeight:
                        skill?.confidenceWeight ??
                        UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
                    renderConfig: skill?.display?.chart,
                };
            }
        ),
        skillResults: analysis.skillResults.map(
            (
                r: Omit<SkillResult, 'confidenceWeight' | 'id'>,
                index: number
            ): SkillResult => ({
                ...r,
                id: skillResultIds[index],
                confidenceWeight:
                    skillByName.get(r.skillName)?.confidenceWeight ??
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
