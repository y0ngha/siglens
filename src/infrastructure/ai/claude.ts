import type { AnalysisResponse } from '@/domain/types';
import type { AIProvider } from './types';

export class ClaudeProvider implements AIProvider {
    async analyze(prompt: string): Promise<AnalysisResponse> {
        // TODO: implement Claude API call
        void prompt;
        return {
            summary: '',
            trend: 'neutral',
            signals: [],
            skillSignals: [],
            riskLevel: 'medium',
            keyLevels: { support: [], resistance: [] },
        };
    }
}
