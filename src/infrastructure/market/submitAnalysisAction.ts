'use server';

import { submitAnalysis } from '@y0ngha/siglens-core';
import type { SubmitAnalysisResult, Timeframe } from '@/domain/types';

export async function submitAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string
): Promise<SubmitAnalysisResult> {
    return submitAnalysis(symbol, timeframe, force, fmpSymbol);
}
