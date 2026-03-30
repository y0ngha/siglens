import type { RawAnalysisResponse } from '@/domain/analysis/confidence';

export type AIProviderType = 'claude' | 'gemini';

export interface AIProvider {
    analyze(prompt: string): Promise<RawAnalysisResponse>;
}
