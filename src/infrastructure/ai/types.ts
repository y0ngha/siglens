export type AnalysisResult = {
    summary: string;
    signals: string[];
    risk: 'low' | 'medium' | 'high';
};

export interface AIProvider {
    analyze(prompt: string): Promise<AnalysisResult>;
}
