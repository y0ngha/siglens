'use server';

import { postAnalyze } from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables } from '@/domain/types';
import type { AnalyzeRouteResponse } from '@/infrastructure/market/analysisApi';

export async function analyzeAction(
    variables: AnalyzeVariables
): Promise<AnalyzeRouteResponse> {
    return postAnalyze(variables);
}
