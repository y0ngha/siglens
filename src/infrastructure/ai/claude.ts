import type { AIProvider, AnalysisResult } from './types';

export class ClaudeProvider implements AIProvider {
  async analyze(prompt: string): Promise<AnalysisResult> {
    // TODO: implement Claude API call
    void prompt;
    return { summary: '', signals: [], risk: 'medium' };
  }
}