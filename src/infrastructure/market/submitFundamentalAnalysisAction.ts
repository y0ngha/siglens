'use server';

import { waitUntil } from '@vercel/functions';
import {
    submitFundamentalAnalysis,
    type SubmitFundamentalAnalysisOptions,
    type SubmitFundamentalAnalysisResult,
} from '@y0ngha/siglens-core';
import { FmpFundamentalClient } from '@/infrastructure/fmp/fundamentalClient';

/**
 * Server Action: submit a fundamental analysis job for the given symbol.
 *
 * Delegates to `submitFundamentalAnalysis` from siglens-core, injecting the
 * FMP-backed data provider. Tier and usage checks are skipped (Phase 4 concern).
 *
 * @param symbol  - U.S. equity ticker (e.g. `"AAPL"`).
 * @param modelId - LLM model identifier used for analysis and cache scoping.
 * @returns Submission outcome — `cached`, `submitted`, or `error`.
 */
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
