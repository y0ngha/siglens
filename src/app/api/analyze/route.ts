import { constants } from 'node:http2';
import { NextRequest, NextResponse } from 'next/server';
import { createAIProvider } from '@/infrastructure/ai/factory';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { enrichAnalysisWithConfidence } from '@/domain/analysis/confidence';
import type { RawAnalysisResponse } from '@/domain/analysis/confidence';
import type { AnalysisResponse, AnalyzeVariables, Skill } from '@/domain/types';

/** app 레이어 전용 응답 타입 — skills 로딩 실패 여부를 포함한 분석 결과 */
interface AnalyzeRouteResponse extends AnalysisResponse {
    skillsDegraded: boolean;
}

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR } =
    constants;

export async function POST(request: NextRequest) {
    const bodyResult = await request.json().catch(() => null);
    if (bodyResult === null) {
        return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }
    const body: AnalyzeVariables = bodyResult;

    const { symbol, bars, indicators } = body;

    if (!symbol || !bars || bars.length === 0 || !indicators) {
        return NextResponse.json(
            { error: 'symbol, bars, and indicators are required' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    const skillsLoader = new FileSkillsLoader();
    const { skills, skillsDegraded } = await skillsLoader
        .loadSkills()
        .then(loadedSkills => ({ skills: loadedSkills, skillsDegraded: false }))
        .catch((error: unknown) => {
            console.error('[/api/analyze] Skills loading failed:', error);
            return { skills: [] as Skill[], skillsDegraded: true };
        });
    const prompt = buildAnalysisPrompt(symbol, bars, indicators, skills);

    const ai = createAIProvider();
    try {
        const analysis = (await ai.analyze(
            prompt
        )) as unknown as RawAnalysisResponse;
        const enriched = enrichAnalysisWithConfidence(analysis, skills);
        const response: AnalyzeRouteResponse = { ...enriched, skillsDegraded };
        return NextResponse.json(response);
    } catch (error) {
        console.error('[/api/analyze] AI analysis failed:', error);
        return NextResponse.json(
            { error: 'AI analysis failed' },
            { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
        );
    }
}
