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
    | 'bollinger_upper_breakout';

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
    readonly detectedAt: number; // bar index within the fetched window
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
    readonly computedAt: string; // ISO timestamp
    readonly stocks: readonly StockSignalResult[];
}
