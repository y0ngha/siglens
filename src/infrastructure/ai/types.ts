export interface Signal {
    type: string;
    description: string;
    strength: 'strong' | 'moderate' | 'weak';
}

export interface SkillSignal {
    skillName: string;
    signals: Signal[];
}

export interface AnalysisResponse {
    summary: string;
    trend: 'bullish' | 'bearish' | 'neutral';
    signals: Signal[];
    skillSignals: SkillSignal[];
    riskLevel: 'low' | 'medium' | 'high';
    keyLevels: {
        support: number[];
        resistance: number[];
    };
}

export interface AIProvider {
    analyze(prompt: string): Promise<AnalysisResponse>;
}
