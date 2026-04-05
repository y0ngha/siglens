'use server';

import {
    runAnalysis,
    type AnalyzeRouteResponse,
} from '@/infrastructure/market/analysisApi';
import type { AnalyzeVariables } from '@/domain/types';

export async function analyzeAction(
    variables: AnalyzeVariables
): Promise<AnalyzeRouteResponse> {
    return runAnalysis(variables);
}
