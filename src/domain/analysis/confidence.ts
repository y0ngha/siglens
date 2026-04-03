import {
    MIN_CONFIDENCE_WEIGHT,
    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';
import type {
    AnalysisResponse,
    CandlePatternSummary,
    PatternResult,
    RawAnalysisResponse,
    Skill,
} from '@/domain/types';

const buildPatternIds = (items: { patternName: string }[]): string[] => {
    const counter = new Map<string, number>();
    return items.map(item => {
        const count = counter.get(item.patternName) ?? 0;
        counter.set(item.patternName, count + 1);
        return `${item.patternName}_${count}`;
    });
};

export function filterPatterns(patterns: PatternResult[]): PatternResult[] {
    return patterns.filter(p => p.confidenceWeight >= MIN_CONFIDENCE_WEIGHT);
}

export function enrichAnalysisWithConfidence(
    analysis: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const skillByName = new Map(skills.map(s => [s.name, s]));
    const patternSummaryIds = buildPatternIds(analysis.patternSummaries);
    const candlePatternIds = buildPatternIds(analysis.candlePatterns);
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map(
            (p, index): PatternResult => {
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
        skillResults: analysis.skillResults.map(r => ({
            ...r,
            confidenceWeight:
                skillByName.get(r.skillName)?.confidenceWeight ??
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
        })),
        candlePatterns: analysis.candlePatterns.map(
            (p, index): CandlePatternSummary => ({
                ...p,
                id: candlePatternIds[index],
            })
        ),
    };
}
