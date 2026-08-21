import { useTranslations } from 'next-intl';
import type { SignalType } from '@y0ngha/siglens-core';

/**
 * 신호 라벨 **키**. `t()`는 소비 컴포넌트에서 부른다.
 *
 * 예전에는 한국어 문자열 36개가 여기 박혀 있어서 `/en/market`이
 * `DMI 골든크로스`·`RSI 하락 다이버전스`를 그대로 렌더했다 — 대시보드에서
 * 가장 눈에 띄는 텍스트다.
 */
const SIGNAL_BADGE_LABEL_KEY: Record<SignalType, string> = {
    rsi_oversold: 'signalType.rsi_oversold',
    rsi_overbought: 'signalType.rsi_overbought',
    golden_cross: 'signalType.golden_cross',
    death_cross: 'signalType.death_cross',
    macd_bullish_cross: 'signalType.macd_bullish_cross',
    macd_bearish_cross: 'signalType.macd_bearish_cross',
    bollinger_lower_bounce: 'signalType.bollinger_lower_bounce',
    bollinger_upper_breakout: 'signalType.bollinger_upper_breakout',
    bollinger_percentb_oversold: 'signalType.bollinger_percentb_oversold',
    bollinger_percentb_overbought: 'signalType.bollinger_percentb_overbought',
    rsi_bullish_divergence: 'signalType.rsi_bullish_divergence',
    rsi_bearish_divergence: 'signalType.rsi_bearish_divergence',
    macd_histogram_bullish_convergence:
        'signalType.macd_histogram_bullish_convergence',
    macd_histogram_bearish_convergence:
        'signalType.macd_histogram_bearish_convergence',
    bollinger_squeeze_bullish: 'signalType.bollinger_squeeze_bullish',
    bollinger_squeeze_bearish: 'signalType.bollinger_squeeze_bearish',
    support_proximity_bullish: 'signalType.support_proximity_bullish',
    resistance_proximity_bearish: 'signalType.resistance_proximity_bearish',
    supertrend_bullish_flip: 'signalType.supertrend_bullish_flip',
    ichimoku_cloud_breakout: 'signalType.ichimoku_cloud_breakout',
    cci_bullish_cross: 'signalType.cci_bullish_cross',
    dmi_bullish_cross: 'signalType.dmi_bullish_cross',
    cmf_bullish_flip: 'signalType.cmf_bullish_flip',
    mfi_oversold_bounce: 'signalType.mfi_oversold_bounce',
    parabolic_sar_flip: 'signalType.parabolic_sar_flip',
    keltner_upper_breakout: 'signalType.keltner_upper_breakout',
    squeeze_momentum_bullish: 'signalType.squeeze_momentum_bullish',
    keltner_lower_breakout: 'signalType.keltner_lower_breakout',
    supertrend_bearish_flip: 'signalType.supertrend_bearish_flip',
    ichimoku_cloud_breakdown: 'signalType.ichimoku_cloud_breakdown',
    cci_bearish_cross: 'signalType.cci_bearish_cross',
    dmi_bearish_cross: 'signalType.dmi_bearish_cross',
    cmf_bearish_flip: 'signalType.cmf_bearish_flip',
    mfi_overbought_reversal: 'signalType.mfi_overbought_reversal',
    parabolic_sar_bearish_flip: 'signalType.parabolic_sar_bearish_flip',
    squeeze_momentum_bearish: 'signalType.squeeze_momentum_bearish',
};

interface SignalBadgeProps {
    type: SignalType;
}

export function SignalBadge({ type }: SignalBadgeProps) {
    // 키를 그대로 넣어야 추출기가 이 파일에서 `shared.enumLabel`을 본다.
    const tLabel = useTranslations('shared.enumLabel');
    return (
        <span className="text-[10px] tracking-wider text-secondary-300 uppercase">
            {tLabel(SIGNAL_BADGE_LABEL_KEY[type])}
        </span>
    );
}
