import type { RawAnalysisResponse } from '@/domain/types';

export type AIProviderType = 'claude' | 'gemini';

export interface AIProvider {
    analyze(prompt: string): Promise<RawAnalysisResponse>;
}
