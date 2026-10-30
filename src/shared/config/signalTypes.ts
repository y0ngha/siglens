import type { SignalType } from '@y0ngha/siglens-core';

/**
 * core `SignalType`의 런타임 목록. core는 타입만 내보내므로 문자열(DB·frontmatter)을
 * 좁히려면 여기가 필요하다. `satisfies Record<SignalType, true>`라 core가 타입을 늘리거나
 * 줄이면 타입체크에서 잡히고, ko 라벨 카탈로그와의 일치는 테스트가 본다.
 */
const SIGNAL_TYPE_SET = {
    bollinger_lower_bounce: true,
    bollinger_percentb_overbought: true,
    bollinger_percentb_oversold: true,
    bollinger_squeeze_bearish: true,
    bollinger_squeeze_bullish: true,
    bollinger_upper_breakout: true,
    cci_bearish_cross: true,
    cci_bullish_cross: true,
    cmf_bearish_flip: true,
    cmf_bullish_flip: true,
    death_cross: true,
    dmi_bearish_cross: true,
    dmi_bullish_cross: true,
    gap_down: true,
    gap_up: true,
    golden_cross: true,
    ichimoku_cloud_breakdown: true,
    ichimoku_cloud_breakout: true,
    keltner_lower_breakout: true,
    keltner_upper_breakout: true,
    macd_bearish_cross: true,
    macd_bullish_cross: true,
    macd_histogram_bearish_convergence: true,
    macd_histogram_bullish_convergence: true,
    mfi_overbought_reversal: true,
    mfi_oversold_bounce: true,
    new_52w_high: true,
    new_52w_low: true,
    parabolic_sar_bearish_flip: true,
    parabolic_sar_flip: true,
    resistance_proximity_bearish: true,
    rsi_bearish_divergence: true,
    rsi_bullish_divergence: true,
    rsi_overbought: true,
    rsi_oversold: true,
    squeeze_momentum_bearish: true,
    squeeze_momentum_bullish: true,
    supertrend_bearish_flip: true,
    supertrend_bullish_flip: true,
    support_proximity_bullish: true,
} as const satisfies Record<SignalType, true>;

// safe: `Object.keys`는 항상 `string[]`로 타이핑되지만 이 객체는 `Record<SignalType, true>`를
// 만족해야 컴파일되므로 키가 정확히 `SignalType` 전체다.
export const SIGNAL_TYPES = Object.keys(
    SIGNAL_TYPE_SET
) as readonly SignalType[];

export function isSignalType(value: unknown): value is SignalType {
    return typeof value === 'string' && Object.hasOwn(SIGNAL_TYPE_SET, value);
}
