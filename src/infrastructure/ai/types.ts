import type { AnalysisResponse } from '@/domain/types';

export type AIProviderType = 'claude' | 'gemini';

export interface AIProvider {
    analyze(prompt: string): Promise<AnalysisResponse>;
}
