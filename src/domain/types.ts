export type Timeframe = '1Min' | '5Min' | '15Min' | '1Hour' | '1Day';

export type Bar = {
    time: number; // Unix timestamp (seconds)
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    vwap?: number; // Alpaca 제공
};

export type MACDResult = {
    macd: number | null;
    signal: number | null;
    histogram: number | null;
};

export type BollingerResult = {
    upper: number | null;
    middle: number | null;
    lower: number | null;
};

export type DMIResult = {
    diPlus: number | null;
    diMinus: number | null;
    adx: number | null;
};

export interface IndicatorResult {
    macd: MACDResult[];
    bollinger: BollingerResult[];
    dmi: DMIResult[];
    rsi: (number | null)[];
    vwap: (number | null)[];
    ma: Record<number, (number | null)[]>;
    ema: Record<number, (number | null)[]>;
}

export type Signal = {
    type: string; // 예: "RSI 과매수", "MACD 골든크로스"
    description: string;
    strength: 'strong' | 'moderate' | 'weak';
};

export type AnalysisResponse = {
    summary: string;
    trend: 'bullish' | 'bearish' | 'neutral';
    signals: Signal[];
    riskLevel: 'low' | 'medium' | 'high';
    keyLevels: {
        support: number[];
        resistance: number[];
    };
};
