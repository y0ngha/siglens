'use server';

import {
    runAnalysis,
    type RunAnalysisResult,
} from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables } from '@/domain/types';

export async function analyzeAction(
    variables: AnalyzeVariables
): Promise<RunAnalysisResult> {
    return runAnalysis(variables);
}
