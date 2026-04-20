import type { SignalType } from '@/domain/types';

const SIGNAL_BADGE_LABELS: Record<SignalType, string> = {
    rsi_oversold: 'RSI 과매도',
    rsi_overbought: 'RSI 과매수',
    golden_cross: '골든크로스',
    death_cross: '데드크로스',
    macd_bullish_cross: 'MACD 상승교차',
    macd_bearish_cross: 'MACD 하락교차',
    bollinger_lower_bounce: '볼린저 하단 반등',
    bollinger_upper_breakout: '볼린저 상단 돌파',
    rsi_bullish_divergence: 'RSI 상승 다이버전스',
    rsi_bearish_divergence: 'RSI 하락 다이버전스',
    macd_histogram_bullish_convergence: 'MACD 히스토그램 수렴(↑)',
    macd_histogram_bearish_convergence: 'MACD 히스토그램 수렴(↓)',
    bollinger_squeeze_bullish: '볼린저 스퀴즈(↑)',
    bollinger_squeeze_bearish: '볼린저 스퀴즈(↓)',
    support_proximity_bullish: '지지선 근접',
    resistance_proximity_bearish: '저항선 근접',
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

interface SignalBadgeProps {
    type: SignalType;
}

export function SignalBadge({ type }: SignalBadgeProps) {
    return (
        <span className="text-secondary-300 text-[10px] tracking-wider uppercase">
            {SIGNAL_BADGE_LABELS[type]}
        </span>
    );
}
