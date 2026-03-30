import type { AnalysisResponse, Skill } from '@/domain/types';

export function enrichAnalysisWithConfidence(
    analysis: AnalysisResponse,
    skills: Skill[]
): AnalysisResponse {
    const skillMap = new Map(skills.map(s => [s.name, s.confidenceWeight]));
    return {
        ...analysis,
        patternSummaries: analysis.patternSummaries.map(p => ({
            ...p,
            confidenceWeight: skillMap.get(p.skillName) ?? 0,
        })),
        skillResults: analysis.skillResults.map(r => ({
            ...r,
            confidenceWeight: skillMap.get(r.skillName) ?? 0,
        })),
    };
}
