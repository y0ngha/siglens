import type { AnalysisResponse } from '@/domain/types';

export interface AIProvider {
    analyze(prompt: string): Promise<AnalysisResponse>;
}
