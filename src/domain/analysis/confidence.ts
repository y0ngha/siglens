import { UNMATCHED_SKILL_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type {
    AnalysisResponse,
    PatternSummary,
    Skill,
    SkillResult,
} from '@/domain/types';

export type RawAnalysisResponse = Omit<
    AnalysisResponse,
    'patternSummaries' | 'skillResults'
> & {
    patternSummaries: Omit<PatternSummary, 'confidenceWeight'>[];
    skillResults: Omit<SkillResult, 'confidenceWeight'>[];
};

export function enrichAnalysisWithConfidence(
    analysis: RawAnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const skillMap = new Map(skills.map(s => [s.name, s.confidenceWeight]));
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map(p => ({
            ...p,
            confidenceWeight:
                skillMap.get(p.skillName) ?? UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
        })),
        skillResults: analysis.skillResults.map(r => ({
            ...r,
            confidenceWeight:
                skillMap.get(r.skillName) ?? UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
        })),
    };
}
