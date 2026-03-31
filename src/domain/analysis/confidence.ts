import { UNMATCHED_SKILL_CONFIDENCE_WEIGHT } from '@/domain/indicators/constants';
import type {
    AnalysisResponse,
    PatternResult,
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
    const skillByName = new Map(skills.map(s => [s.name, s]));
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map(
            (p): PatternResult => ({
                ...p,
                confidenceWeight:
                    skillByName.get(p.skillName)?.confidenceWeight ??
                    UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
                renderConfig: skillByName.get(p.skillName)?.display?.chart,
            })
        ),
        skillResults: analysis.skillResults.map(r => ({
            ...r,
            confidenceWeight:
                skillByName.get(r.skillName)?.confidenceWeight ??
                UNMATCHED_SKILL_CONFIDENCE_WEIGHT,
        })),
    };
}
