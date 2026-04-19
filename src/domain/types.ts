export type Timeframe = '5Min' | '15Min' | '30Min' | '1Hour' | '4Hour' | '1Day';

export interface IndexTicker {
    symbol: string;
    fmpSymbol: string;
    displayName: string;
    koreanName: string;
}

export interface SectorEtf {
    symbol: string;
    sectorName: string;
    koreanName: string;
}

export interface MarketQuote {
    symbol: string;
    price: number;
    changesPercentage: number;
    name: string;
}

export interface MarketIndexData {
    symbol: string;
    fmpSymbol: string;
    displayName: string;
    koreanName: string;
    price: number;
    changesPercentage: number;
}

export interface MarketSectorData {
    symbol: string;
    sectorName: string;
    koreanName: string;
    price: number;
    changesPercentage: number;
}

export interface MarketSummaryData {
    indices: MarketIndexData[];
    sectors: MarketSectorData[];
}

export interface MarketBriefingSectorAnalysis {
    leadingSectors: string[];
    laggingSectors: string[];
    performanceDescription: string;
}

export interface MarketBriefingVolatilityAnalysis {
    vixLevel?: number;
    description: string;
}

export interface MarketBriefingResponse {
    summary: string;
    dominantThemes: string[];
    sectorAnalysis: MarketBriefingSectorAnalysis;
    volatilityAnalysis: MarketBriefingVolatilityAnalysis;
    riskSentiment: string;
}

export type SubmitBriefingResult =
    | {
          status: 'cached';
          briefing: MarketBriefingResponse;
          generatedAt: string;
      }
    | { status: 'submitted'; jobId: string };

export type PollBriefingResult =
    | { status: 'processing' }
    | { status: 'done'; briefing: MarketBriefingResponse; generatedAt: string }
    | { status: 'error'; error: string };

export interface SectorGroupDef {
    label: string;
    symbols: readonly string[];
}

export interface MarketSummaryActionResult {
    summary: MarketSummaryData;
    briefing: SubmitBriefingResult;
}

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
    momentum: number | null;
    /** BB is inside KC — volatility compressed, breakout imminent */
    sqzOn: boolean | null;
    /** BB is outside KC — squeeze released, momentum expanding */
    sqzOff: boolean | null;
    /** Neither sqzOn nor sqzOff — transitional state */
    noSqz: boolean | null;
    /** momentum is increasing vs previous bar (momentum strengthening) */
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

export type AnalysisSignalType = 'skill';

export type SignalStrength = 'strong' | 'moderate' | 'weak';

export type Trend = 'bullish' | 'bearish' | 'neutral';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface AnalysisSignal {
    type: AnalysisSignalType;
    description: string;
    strength?: SignalStrength;
    trend: Trend;
}

export interface IndicatorGuideResult {
    indicatorName: string;
    signals: AnalysisSignal[];
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

export interface ClusteredKeyLevel extends KeyLevel {
    count: number;
    sources: KeyLevel[];
}

export interface ClusteredKeyLevels {
    support: ClusteredKeyLevel[];
    resistance: ClusteredKeyLevel[];
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
    bullish: PriceScenario | null;
    bearish: PriceScenario | null;
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
    /** ISO 8601 timestamp of when this analysis was performed. */
    analyzedAt?: string;
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
    /** FMP API 심볼 (지수의 경우 ^ 접두사 포함, 예: ^SPX). 일반 주식은 undefined. */
    fmpSymbol?: string;
}

export type CategoryId =
    | 'megacap'
    | 'ai-semiconductor'
    | 'software-cloud'
    | 'fintech-crypto'
    | 'leveraged-etf'
    | 'healthcare-bio'
    | 'quantum-computing'
    | 'ev-mobility'
    | 'energy-industrial';

export interface TickerCategory {
    id: CategoryId;
    label: string;
    tickers: readonly string[];
}

export interface RunAnalysisInput {
    symbol: string;
    bars: Bar[];
    indicators: IndicatorResult;
}

/**
 * LLM이 반환하는 원시 분석 응답.
 *
 * 프롬프트에서는 모든 필드를 required로 요청하지만,
 * LLM 특성상 누락·null 반환뿐 아니라 잘못된 타입(예: string 필드에 객체)으로
 * 반환되는 케이스까지 관측된다. 따라서 모든 필드를 unknown으로 받아
 * {@link enrichAnalysisWithConfidence}에서 런타임 정규화한 뒤
 * {@link AnalysisResponse}로 변환한다.
 */
export interface RawAnalysisResponse {
    summary?: unknown;
    trend?: unknown;
    indicatorResults?: unknown;
    riskLevel?: unknown;
    keyLevels?: unknown;
    priceTargets?: unknown;
    patternSummaries?: unknown;
    strategyResults?: unknown;
    candlePatterns?: unknown;
    trendlines?: unknown;
    actionRecommendation?: unknown;
}

// --- Job Result Types (submit + poll 패턴) ---

/** submitAnalysisAction 반환 타입 */
export type SubmitAnalysisResult =
    | { status: 'cached'; result: AnalysisResponse }
    | { status: 'submitted'; jobId: string };

/** pollAnalysisAction 반환 타입 */
export type PollAnalysisResult =
    | { status: 'processing' }
    | { status: 'done'; result: AnalysisResponse }
    | { status: 'error'; error: string };

export interface SectorStock {
    symbol: string;
    koreanName: string;
    sectorSymbol: string; // XLK, XLF, XLE, ...
}

// ─── Sector Signal Discovery (Panel C) ───────────────────────────────────────

export type SignalDirection = 'bullish' | 'bearish';
export type SignalPhase = 'confirmed' | 'expected';

export type ConfirmedSignalType =
    | 'rsi_oversold'
    | 'rsi_overbought'
    | 'golden_cross'
    | 'death_cross'
    | 'macd_bullish_cross'
    | 'macd_bearish_cross'
    | 'bollinger_lower_bounce'
    | 'bollinger_upper_breakout'
    | 'supertrend_bullish_flip'
    | 'parabolic_sar_flip'
    | 'ichimoku_cloud_breakout'
    | 'cci_bullish_cross'
    | 'dmi_bullish_cross'
    | 'cmf_bullish_flip'
    | 'mfi_oversold_bounce';

export type ExpectedSignalType =
    | 'rsi_bullish_divergence'
    | 'rsi_bearish_divergence'
    | 'macd_histogram_bullish_convergence'
    | 'macd_histogram_bearish_convergence'
    | 'bollinger_squeeze_bullish'
    | 'bollinger_squeeze_bearish'
    | 'support_proximity_bullish'
    | 'resistance_proximity_bearish';

export type SignalType = ConfirmedSignalType | ExpectedSignalType;

export interface Signal {
    readonly type: SignalType;
    readonly direction: SignalDirection;
    readonly phase: SignalPhase;
    readonly detectedAt: number;
}

export type TrendState = 'uptrend' | 'downtrend' | 'sideways';

export interface StockSignalResult {
    readonly symbol: string;
    readonly koreanName: string;
    readonly sectorSymbol: string;
    readonly price: number;
    readonly changePercent: number;
    readonly trend: TrendState;
    readonly signals: readonly Signal[];
}

export interface SectorSignalsResult {
    readonly computedAt: string;
    readonly stocks: readonly StockSignalResult[];
}

export type DashboardTimeframe = '15Min' | '1Hour' | '1Day';

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessage {
    role: 'user' | 'model';
    content: string;
}

export type ChatLoadingPhase = 'analyzing' | 'generating';

export interface ChatSession {
    messages: ChatMessage[];
    savedAt: number; // Unix timestamp (ms)
}

export type ChatErrorCode = 'token_exhausted' | 'rate_limited' | 'server_error';

export type ChatActionResult =
    | { ok: true; message: string; remainingTokens: number }
    | { ok: false; error: ChatErrorCode };

export interface ChatPromptPayload {
    systemPrompt: string;
    messages: ChatMessage[];
}

// ─── Backtesting ──────────────────────────────────────────────────────────────

export type BacktestSignalResult = 'win' | 'loss';
export type BacktestAiResult = 'win' | 'loss' | 'neutral';
export type BacktestExitReason = 'take_profit' | 'stop_loss' | 'time';

export interface BacktestAiAnalysis {
    summary: string;
    tags: string[];
}

export interface BacktestCase {
    ticker: string;
    entryDate: string;
    entryPrice: number;
    exitDate: string;
    exitPrice: number;
    holdingDays: number;
    returnPct: number;
    signalType: 'buy';
    result: BacktestSignalResult;
    exitReason: BacktestExitReason;
    aiResult: BacktestAiResult;
    aiTrendHit: boolean;
    aiAnalysis: BacktestAiAnalysis;
}

export interface BacktestMeta {
    period: string;
    totalCases: number;
    winRate: number;
    aiWinRate: number;
    aiTrendHitRate: number;
    tickerCount: number;
}

export interface BacktestData {
    meta: BacktestMeta;
    cases: BacktestCase[];
}
