export type SignalType =
    | 'rsi_overbought'
    | 'rsi_oversold'
    | 'macd_golden_cross'
    | 'macd_dead_cross'
    | 'bollinger_upper_breakout'
    | 'bollinger_lower_breakout'
    | 'bollinger_squeeze'
    | 'dmi_bullish_trend'
    | 'dmi_bearish_trend'
    | 'pattern'
    | 'skill';

export type SignalStrength = 'strong' | 'moderate' | 'weak';

export type Trend = 'bullish' | 'bearish' | 'neutral';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Signal {
    type: SignalType;
    description: string;
    strength: SignalStrength;
}

export interface SkillSignal {
    skillName: string;
    signals: Signal[];
}

export interface KeyLevels {
    support: number[];
    resistance: number[];
}

export interface AnalysisResponse {
    summary: string;
    trend: Trend;
    signals: Signal[];
    skillSignals: SkillSignal[];
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
}

export interface AIProvider {
    analyze(prompt: string): Promise<AnalysisResponse>;
}
