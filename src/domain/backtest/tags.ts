const TAG_LABEL_MAP: Record<string, string> = {
    // 기존 confirmed bullish (Task 4-12 이전)
    rsi_oversold: 'RSI 과매도 반등',
    golden_cross: 'EMA 골든크로스',
    macd_bullish_cross: 'MACD 골든크로스',
    bollinger_lower_bounce: 'BB 하단 반등',
    // 기존 anticipation bullish
    rsi_bullish_divergence: 'RSI 강세 다이버전스',
    macd_histogram_bullish_convergence: 'MACD 히스토그램 강세 수렴',
    bollinger_squeeze_bullish: 'BB 수축 강세',
    support_proximity_bullish: '지지선 근접',
    // 신규 confirmed bullish (Task 4-12)
    supertrend_bullish_flip: 'Supertrend 전환',
    ichimoku_cloud_breakout: 'Ichimoku 구름 돌파',
    cci_bullish_cross: 'CCI 100 돌파',
    dmi_bullish_cross: 'DMI 골든크로스',
    cmf_bullish_flip: 'CMF 매집 전환',
    mfi_oversold_bounce: 'MFI 과매도 반등',
    parabolic_sar_flip: 'Parabolic SAR 전환',
    keltner_upper_breakout: 'Keltner 상단 돌파',
    squeeze_momentum_bullish: 'Squeeze 양전환',
};

export function signalTypeToTagLabel(type: string): string {
    return TAG_LABEL_MAP[type] ?? type;
}
