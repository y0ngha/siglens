export const CHART_COLORS = {
    // 차트 배경 / 그리드 / 텍스트
    background: '#0f172a',
    grid: '#1e293b',
    text: '#94a3b8',

    // 상승 / 하락 / 중립
    bullish: '#26a69a',
    bearish: '#ef5350',
    neutral: '#94a3b8',

    // 거래량 (50% 투명도)
    volumeBullish: '#26a69a80',
    volumeBearish: '#ef535080',

    // MA / EMA 기간별 컬러 (MA 실선, EMA 점선 공용)
    period5: '#ef4444',
    period10: '#f97316',
    period20: '#eab308',
    period60: '#22c55e',
    period120: '#3b82f6',
    period200: '#a855f7',

    // 볼린저 밴드
    bollingerUpper: '#818cf8',
    bollingerMiddle: '#94a3b8',
    bollingerLower: '#818cf8',
    bollingerBackground: '#818cf820',

    // MACD
    macdLine: '#3b82f6',
    macdSignal: '#f59e0b',
    macdHistogramBullish: '#26a69a',
    macdHistogramBearish: '#ef5350',

    // RSI
    rsiLine: '#a78bfa',
    rsiOverbought: '#ef535060',
    rsiOversold: '#26a69a60',

    // DMI
    dmiPlus: '#26a69a',
    dmiMinus: '#ef5350',
    dmiAdx: '#f59e0b',

    // VWAP
    vwap: '#e879f9',
} as const;

const PERIOD_COLOR_MAP: Record<number, string> = {
    5: CHART_COLORS.period5,
    10: CHART_COLORS.period10,
    20: CHART_COLORS.period20,
    60: CHART_COLORS.period60,
    120: CHART_COLORS.period120,
    200: CHART_COLORS.period200,
};

export function getPeriodColor(period: number): string {
    return PERIOD_COLOR_MAP[period] ?? CHART_COLORS.neutral;
}
