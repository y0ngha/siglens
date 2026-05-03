'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

/** Server Action: submit a fundamental analysis job; delegates to siglens-core with FMP provider; returns `cached | submitted | error`. */
export async function submitFundamentalAnalysisAction(
    symbol: string,
    modelId: SubmitFundamentalAnalysisOptions['modelId']
): Promise<SubmitFundamentalAnalysisResult> {
    return submitFundamentalAnalysis({
        symbol,
        modelId,
        dataProvider: new FmpFundamentalClient(),
        waitUntil,
    });
}
