'use server';

import { waitUntil } from '@vercel/functions';
import { submitAnalysis } from '@y0ngha/siglens-core';
import type { SubmitAnalysisResult, Timeframe } from '@y0ngha/siglens-core';

export async function submitAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string
): Promise<SubmitAnalysisResult> {
    return submitAnalysis(symbol, timeframe, force, fmpSymbol, { waitUntil });
}
