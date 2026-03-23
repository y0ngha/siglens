import { constants } from 'node:http2';
import { NextRequest, NextResponse } from 'next/server';
import { ClaudeProvider } from '@/infrastructure/ai/claude';
import { buildAnalysisPrompt } from '@/domain/analysis/prompt';
import type { Bar, IndicatorResult } from '@/domain/types';

const { HTTP_STATUS_BAD_REQUEST } = constants;

interface AnalyzeRequest {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}

export async function POST(request: NextRequest) {
    const body: AnalyzeRequest = await request.json();
    const { symbol, bars, indicators } = body;

    if (!symbol || !bars || !indicators) {
        return NextResponse.json(
            { error: 'symbol, bars, and indicators are required' },
            { status: HTTP_STATUS_BAD_REQUEST }
        );
    }

    const prompt = buildAnalysisPrompt(symbol, bars, indicators);

    const ai = new ClaudeProvider();
    const analysis = await ai.analyze(prompt);

    return NextResponse.json(analysis);
}
