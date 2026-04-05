import { createAIProvider } from '@/infrastructure/ai/factory';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { AnalysisResponse, AnalyzeVariables, Skill } from '@/domain/types';

/** infrastructure 레이어 전용 응답 타입 — skills 로딩 실패 여부를 포함한 분석 결과 */
export interface RunAnalysisResult extends AnalysisResponse {
    skillsDegraded: boolean;
}

export async function runAnalysis({
    symbol,
    bars,
    indicators,
}: AnalyzeVariables): Promise<RunAnalysisResult> {
    if (!symbol || !bars || bars.length === 0 || !indicators) {
        throw new Error('symbol, bars, and indicators are required');
    }

    const skillsLoader = new FileSkillsLoader();
    const { skills, skillsDegraded } = await skillsLoader
        .loadSkills()
        .then(loadedSkills => ({ skills: loadedSkills, skillsDegraded: false }))
        .catch((error: unknown) => {
            console.error('[runAnalysis] Skills loading failed:', error);
            const emptySkills: Skill[] = [];
            return { skills: emptySkills, skillsDegraded: true };
        });

    const prompt = buildAnalysisPrompt(symbol, bars, indicators, skills);

    const ai = createAIProvider();
    const analysis = await ai.analyze(prompt);
    const enriched = enrichAnalysisWithConfidence(analysis, skills);

    return { ...enriched, skillsDegraded };
}
