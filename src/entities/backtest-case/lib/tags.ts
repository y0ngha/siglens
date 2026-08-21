export const TAG_LABEL_MAP: Record<string, string> = {
    // 기존 confirmed bullish (Task 4-12 이전)
    rsi_oversold: 'signalType.rsi_oversold',
    golden_cross: 'signalType.golden_cross',
    macd_bullish_cross: 'signalType.macd_bullish_cross',
    bollinger_lower_bounce: 'signalType.bollinger_lower_bounce',
    // 기존 anticipation bullish
    rsi_bullish_divergence: 'signalType.rsi_bullish_divergence',
    macd_histogram_bullish_convergence:
        'signalType.macd_histogram_bullish_convergence',
    bollinger_squeeze_bullish: 'signalType.bollinger_squeeze_bullish',
    support_proximity_bullish: 'signalType.support_proximity_bullish',
    // 신규 confirmed bullish (Task 4-12)
    supertrend_bullish_flip: 'signalType.supertrend_bullish_flip',
    ichimoku_cloud_breakout: 'signalType.ichimoku_cloud_breakout',
    cci_bullish_cross: 'signalType.cci_bullish_cross',
    dmi_bullish_cross: 'signalType.dmi_bullish_cross',
    cmf_bullish_flip: 'signalType.cmf_bullish_flip',
    mfi_oversold_bounce: 'signalType.mfi_oversold_bounce',
    parabolic_sar_flip: 'signalType.parabolic_sar_flip',
    keltner_upper_breakout: 'signalType.keltner_upper_breakout',
    squeeze_momentum_bullish: 'signalType.squeeze_momentum_bullish',
};

/**
 * Signal type 문자열을 UI 표시용 한글 라벨로 변환.
 * 파라미터 타입은 의도적으로 `string` — data.json 등 외부 경로에서 올 수 있는
 * 미등록 type을 안전하게 fallback 처리하기 위함. 등록된 type은 TAG_LABEL_MAP으로 완전성 테스트.
 */
export function signalTypeToTagLabel(type: string): string {
    return TAG_LABEL_MAP[type] ?? type;
}
