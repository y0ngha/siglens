'use server';

import { waitUntil } from '@vercel/functions';
import {
    type SubmitAnalysisGatedResult,
    type Timeframe,
    submitAnalysis,
} from '@y0ngha/siglens-core';

export async function submitAnalysisAction(
    symbol: string,
    timeframe: Timeframe,
    force?: boolean,
    fmpSymbol?: string
): Promise<SubmitAnalysisGatedResult> {
    return submitAnalysis(symbol, timeframe, force, fmpSymbol, { waitUntil });
}
