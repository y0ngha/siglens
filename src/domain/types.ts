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

export interface StochasticResult {
    percentK: number | null;
    percentD: number | null;
}

export interface StochRSIResult {
    k: number | null;
    d: number | null;
}

export interface VolumeProfileRow {
    price: number;
    volume: number;
}

export interface VolumeProfileResult {
    poc: number;
    vah: number;
    val: number;
    profile: VolumeProfileRow[];
}

export interface IchimokuResult {
    tenkan: number | null;
    kijun: number | null;
    senkouA: number | null;
    senkouB: number | null;
    chikou: number | null;
}

export interface IchimokuFuturePoint {
    senkouA: number | null;
    senkouB: number | null;
}

export interface IndicatorResult {
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    stochastic: StochasticResult[];
    stochRsi: StochRSIResult[];
    rsi: (number | null)[];
    cci: (number | null)[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
    volumeProfile: VolumeProfileResult | null;
    ichimoku: IchimokuResult[];
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

export type SkillType =
    | 'pattern'
    | 'indicator_guide'
    | 'strategy'
    | 'candlestick';

export interface Skill {
    name: string;
    description: string;
    type?: SkillType;
    category?: SkillCategory;
    pattern?: string;
    indicators: string[];
    confidenceWeight: number;
    content: string;
    display?: SkillDisplay;
}

export type SkillShowcaseItem = Pick<
    Skill,
    'name' | 'description' | 'type' | 'confidenceWeight'
>;

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

export interface KeyPrice {
    label: string;
    price: number;
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

export interface PatternLine {
    label: string;
    start: TrendlinePoint;
    end: TrendlinePoint;
}

export interface PatternSummary {
    id: string;
    patternName: string;
    skillName: string;
    detected: boolean;
    trend: Trend;
    summary: string;
    keyPrices?: KeyPrice[];
    patternLines?: PatternLine[];
    timeRange?: { start: number; end: number };
    confidenceWeight: number;
}

export interface PatternResult extends PatternSummary {
    renderConfig?: SkillChartDisplay;
}

export interface SkillResult {
    id: string;
    skillName: string;
    trend: Trend;
    summary: string;
    confidenceWeight: number;
}

export interface CandlePatternSummary {
    id: string;
    patternName: string;
    detected: boolean;
    trend: Trend;
    summary: string;
}

export type TrendlineDirection = 'ascending' | 'descending';

export interface TrendlinePoint {
    time: number; // Unix timestamp (seconds)
    price: number;
}

export interface Trendline {
    direction: TrendlineDirection;
    start: TrendlinePoint;
    end: TrendlinePoint;
}

export interface ValidatedActionPrices {
    entryPrices: number[];
    stopLoss: number | undefined;
    takeProfitPrices: number[];
}

export interface ActionRecommendation {
    positionAnalysis: string;
    entry: string;
    exit: string;
    riskReward: string;
    // 차트 오버레이용 구조화된 가격
    entryPrices?: number[]; // 진입가 범위 [low, high] 또는 단일 [price]
    stopLoss?: number; // 손절가 (단일)
    takeProfitPrices?: number[]; // 목표가 (복수 가능, 오름차순)
}

export interface AnalysisResponse {
    summary: string;
    trend: Trend;
    signals: Signal[];
    skillSignals: SkillSignal[];
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
    priceTargets: PriceTargets;
    patternSummaries: PatternResult[];
    skillResults: SkillResult[];
    candlePatterns: CandlePatternSummary[];
    trendlines: Trendline[];
    actionRecommendation?: ActionRecommendation;
}

export interface BarsData {
    bars: Bar[];
    indicators: IndicatorResult;
}

export interface TickerBase {
    symbol: string;
    name: string;
    exchange: string;
    exchangeFullName: string;
}

export interface KoreanTickerEntry extends TickerBase {
    koreanName: string;
}

export interface TickerSearchResult extends TickerBase {
    koreanName?: string;
}

export interface AssetInfo {
    symbol: string;
    name: string;
    koreanName?: string;
}

export interface AnalyzeVariables {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}

export type RawAnalysisResponse = Omit<
    AnalysisResponse,
    'patternSummaries' | 'skillResults' | 'candlePatterns'
> & {
    patternSummaries: Omit<PatternSummary, 'confidenceWeight' | 'id'>[];
    skillResults: Omit<SkillResult, 'confidenceWeight' | 'id'>[];
    candlePatterns: Omit<CandlePatternSummary, 'id'>[];
};
