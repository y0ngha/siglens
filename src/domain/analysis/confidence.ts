import {
    MIN_CONFIDENCE_WEIGHT,
    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
} from '@/domain/indicators/constants';
import type {
    AnalysisResponse,
    PatternResult,
    RawAnalysisResponse,
    Skill,
} from '@/domain/types';

export function filterPatterns(patterns: PatternResult[]): PatternResult[] {
    return patterns.filter(p => p.confidenceWeight >= MIN_CONFIDENCE_WEIGHT);
}

export function enrichAnalysisWithConfidence(
    analysis: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const skillByName = new Map(skills.map(s => [s.name, s]));
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map((p): PatternResult => {
            const skill = skillByName.get(p.skillName);
            return {
                ...p,
                confidenceWeight:
                    skill?.confidenceWeight ??
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
                renderConfig: skill?.display?.chart,
            };
        }),
        skillResults: analysis.skillResults.map(r => ({
            ...r,
            confidenceWeight:
                skillByName.get(r.skillName)?.confidenceWeight ??
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
        })),
    };
}
