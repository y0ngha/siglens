export type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

export interface Bar {
    time: number; // Unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number; // Alpaca 제공
}

export interface BarsResponse {
    bars: Bar[];
    hasMore: boolean;
}

export interface MACDResult {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
}

export interface BollingerResult {
    upper: number | null;
    middle: number | null;
    lower: number | null;
}

export interface DMIResult {
    diPlus: number | null;
    diMinus: number | null;
    adx: number | null;
}

export interface IndicatorResult {
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    rsi: (number | null)[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
}

export type ChartDisplayType = 'line' | 'marker' | 'region';

export type SkillCategory =
    | 'reversal_bullish'
    | 'reversal_bearish'
    | 'continuation_bullish'
    | 'continuation_bearish'
    | 'neutral';

export interface SkillChartDisplay {
    show: boolean;
    type: ChartDisplayType;
    color: string;
    label: string;
}

export interface SkillDisplay {
    chart: SkillChartDisplay;
}

export interface Skill {
    name: string;
    description: string;
    type?: 'pattern';
    category?: SkillCategory;
    pattern?: string;
    indicators: string[];
    confidenceWeight: number;
    content: string;
    display?: SkillDisplay;
}

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

export interface KeyLevel {
    price: number;
    reason: string;
}

export interface KeyLevels {
    support: KeyLevel[];
    resistance: KeyLevel[];
    poc?: KeyLevel;
}

export interface PriceTarget {
    price: number;
    basis: string;
}

export interface PriceScenario {
    targets: PriceTarget[];
    condition: string;
}

export interface PriceTargets {
    bullish: PriceScenario;
    bearish: PriceScenario;
}

export interface PatternSummary {
    patternName: string;
    skillName: string;
    detected: boolean;
    trend: Trend;
    summary: string;
    keyPrices?: number[];
    timeRange?: { start: number; end: number };
    confidenceWeight: number;
}

export interface PatternResult extends PatternSummary {
    renderConfig?: SkillChartDisplay;
}

export interface SkillResult {
    skillName: string;
    trend: Trend;
    summary: string;
    confidenceWeight: number;
}

export interface CandlePatternSummary {
    patternName: string;
    detected: boolean;
    trend: Trend;
    summary: string;
}

export interface AnalysisResponse {
    summary: string;
    trend: Trend;
    signals: Signal[];
    skillSignals: SkillSignal[];
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
    priceTargets: PriceTargets;
    patternSummaries: PatternSummary[];
    skillResults: SkillResult[];
    candlePatterns: CandlePatternSummary[];
}

export interface BarsData {
    bars: Bar[];
    indicators: IndicatorResult;
}

export interface AnalyzeVariables {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}
