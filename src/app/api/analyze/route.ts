import { constants } from 'node:http2';
import { NextRequest, NextResponse } from 'next/server';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { FileSkillsLoader } from '@/infrastructure/skills/loader';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type { Bar, IndicatorResult } from '@/domain/types';

const { HTTP_STATUS_BAD_REQUEST, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

interface AnalyzeRequest {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}

export async function POST(request: NextRequest) {
    let body: AnalyzeRequest;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    const { symbol, bars, indicators } = body;

    if (!symbol || !bars || !indicators) {
        return NextResponse.json(
            { error: 'symbol, bars, and indicators are required' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    const skillsLoader = new FileSkillsLoader();
    const skills = await skillsLoader.loadSkills();
    const prompt = buildAnalysisPrompt(symbol, bars, indicators, skills);

    const ai = new ClaudeProvider();
    try {
        const analysis = await ai.analyze(prompt);
        return NextResponse.json(analysis);
    } catch {
        return NextResponse.json(
            { error: 'AI analysis failed' },
            { status: HTTP_STATUS_INTERNAL_SERVER_ERROR }
        );
    }
}
