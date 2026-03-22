import { NextRequest, NextResponse } from 'next/server';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import { detectPatterns } from '@/domain/patterns';
import type { Bar, IndicatorResult } from '@/domain/types';

type RequestBody = {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
};

export async function POST(request: NextRequest) {
    const body: RequestBody = await request.json();
    const { symbol, bars, indicators } = body;

    const patterns = detectPatterns(bars, []);
    const prompt = buildAnalysisPrompt(symbol, bars, indicators, patterns);

    const ai = new ClaudeProvider();
    const analysis = await ai.analyze(prompt);

    return NextResponse.json(analysis);
}
