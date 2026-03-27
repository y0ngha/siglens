import type { AnalysisResponse, Bar, IndicatorResult } from '@/domain/types';

export interface AnalyzeVariables {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}

export async function postAnalyze({
    symbol,
    bars,
    indicators,
}: AnalyzeVariables): Promise<AnalysisResponse> {
    const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, bars, indicators }),
    });
    if (!res.ok) {
        throw new Error(`분석 요청에 실패했습니다 (${res.status})`);
    }
    return res.json() as Promise<AnalysisResponse>;
}
