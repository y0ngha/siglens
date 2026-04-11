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

export type PriceTrend = 'up' | 'down';

export type TrendDirection = PriceTrend | null;

export interface ParabolicSARResult {
    sar: number | null;
    trend: TrendDirection;
}

export interface SupertrendResult {
    supertrend: number | null;
    trend: TrendDirection;
}

export interface KeltnerChannelResult {
    upper: number | null;
    middle: number | null;
    lower: number | null;
}

export interface DonchianChannelResult {
    upper: number | null;
    middle: number | null;
    lower: number | null;
}

export interface BuySellVolumeResult {
    buyVolume: number;
    sellVolume: number;
}

// ─── Smart Money Concepts ────────────────────────────────────────────────────
// Concept reference: Smart Money Concepts (SMC) / ICT methodology
// Original TradingView indicator: "Smart Money Concepts [LuxAlgo]" by LuxAlgo
// This is an independent TypeScript implementation based on publicly documented
// SMC trading concepts. Not a port of LuxAlgo's PineScript source code.
// ─────────────────────────────────────────────────────────────────────────────

export type SMCStructureDirection = 'bullish' | 'bearish';
export type SMCBreakType = 'bos' | 'choch';
export type SMCSwingPointType = 'high' | 'low';
export type SMCZoneType = 'premium' | 'discount' | 'equilibrium';

export interface SMCSwingPoint {
    index: number;
    price: number;
    type: SMCSwingPointType;
}

export interface SMCOrderBlock {
    startIndex: number;
    high: number;
    low: number;
    type: SMCStructureDirection;
    isMitigated: boolean;
}

export interface SMCFairValueGap {
    index: number;
    high: number;
    low: number;
    type: SMCStructureDirection;
    isMitigated: boolean;
}

export interface SMCEqualLevel {
    price: number;
    firstIndex: number;
    secondIndex: number;
    type: SMCSwingPointType;
}

export interface SMCZone {
    high: number;
    low: number;
    type: SMCZoneType;
}

export interface SMCStructureBreak {
    index: number;
    price: number;
    type: SMCStructureDirection;
    breakType: SMCBreakType;
}

export interface SMCResult {
    swingHighs: SMCSwingPoint[];
    swingLows: SMCSwingPoint[];
    orderBlocks: SMCOrderBlock[];
    fairValueGaps: SMCFairValueGap[];
    equalHighs: SMCEqualLevel[];
    equalLows: SMCEqualLevel[];
    premiumZone: SMCZone | null;
    discountZone: SMCZone | null;
    equilibriumZone: SMCZone | null;
    structureBreaks: SMCStructureBreak[];
}

// ─── Squeeze Momentum Indicator ─────────────────────────────────────────────
// Original concept: "Squeeze Momentum Indicator [LazyBear]" by LazyBear
// PineScript source: https://www.tradingview.com/v/4IneGo8h/
// This is an independent TypeScript implementation based on the publicly
// documented algorithm. Not a direct port of the PineScript source code.
// ─────────────────────────────────────────────────────────────────────────────

export interface SqueezeMomentumResult {
    /** Momentum value from linear regression. Positive = bullish, negative = bearish. */
    val: number | null;
    /** BB is inside KC — volatility compressed, breakout imminent */
    sqzOn: boolean | null;
    /** BB is outside KC — squeeze released, momentum expanding */
    sqzOff: boolean | null;
    /** Neither sqzOn nor sqzOff — transitional state */
    noSqz: boolean | null;
    /** val is increasing vs previous bar (momentum strengthening) */
    increasing: boolean | null;
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
    atr: (number | null)[];
    obv: (number | null)[];
    parabolicSar: ParabolicSARResult[];
    williamsR: (number | null)[];
    supertrend: SupertrendResult[];
    mfi: (number | null)[];
    keltnerChannel: KeltnerChannelResult[];
    cmf: (number | null)[];
    donchianChannel: DonchianChannelResult[];
    buySellVolume: BuySellVolumeResult[];
    smc: SMCResult;
    squeezeMomentum: SqueezeMomentumResult[];
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
    | 'candlestick'
    | 'support_resistance';

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

export interface SkillCounts {
    indicators: number;
    candlesticks: number;
    patterns: number;
    strategies: number;
    supportResistance: number;
}

export type SignalType = 'skill';

export type SignalStrength = 'strong' | 'moderate' | 'weak';

export type Trend = 'bullish' | 'bearish' | 'neutral';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface Signal {
    type: SignalType;
    description: string;
    strength: SignalStrength;
}

export interface IndicatorGuideResult {
    indicatorName: string;
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

export interface StrategyResult {
    id: string;
    strategyName: string;
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

export type EntryRecommendation = 'enter' | 'wait' | 'avoid';

export interface ActionRecommendation {
    positionAnalysis: string;
    entry: string;
    exit: string;
    riskReward: string;
    entryRecommendation?: EntryRecommendation;
    // 차트 오버레이용 구조화된 가격
    entryPrices?: number[]; // 진입가 범위 [low, high] 또는 단일 [price]
    stopLoss?: number; // 손절가 (단일)
    takeProfitPrices?: number[]; // 목표가 (복수 가능, 오름차순)
}

export interface AnalysisResponse {
    summary: string;
    trend: Trend;
    indicatorResults: IndicatorGuideResult[];
    riskLevel: RiskLevel;
    keyLevels: KeyLevels;
    priceTargets: PriceTargets;
    patternSummaries: PatternResult[];
    strategyResults: StrategyResult[];
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
    'patternSummaries' | 'strategyResults' | 'candlePatterns'
> & {
    patternSummaries: Omit<PatternSummary, 'confidenceWeight' | 'id'>[];
    strategyResults: Omit<StrategyResult, 'confidenceWeight' | 'id'>[];
    candlePatterns: Omit<CandlePatternSummary, 'id'>[];
};
