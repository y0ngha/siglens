import type { SignalType } from '@y0ngha/siglens-core';

const SIGNAL_BADGE_LABELS: Record<SignalType, string> = {
    rsi_oversold: 'RSI 과매도',
    rsi_overbought: 'RSI 과매수',
    golden_cross: '골든크로스',
    death_cross: '데드크로스',
    macd_bullish_cross: 'MACD 상승교차',
    macd_bearish_cross: 'MACD 하락교차',
    bollinger_lower_bounce: '볼린저 하단 반등',
    bollinger_upper_breakout: '볼린저 상단 돌파',
    bollinger_percentb_oversold: '볼린저 %B 과매도 반등',
    bollinger_percentb_overbought: '볼린저 %B 과매수 반전',
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
    keltner_lower_breakout: 'Keltner 하단 돌파',
    supertrend_bearish_flip: 'Supertrend 하락 전환',
    ichimoku_cloud_breakdown: 'Ichimoku 구름 이탈',
    cci_bearish_cross: 'CCI 하락 교차',
    dmi_bearish_cross: 'DMI 데드크로스',
    cmf_bearish_flip: 'CMF 분산 전환',
    mfi_overbought_reversal: 'MFI 과매수 반전',
    parabolic_sar_bearish_flip: 'Parabolic SAR 하락 전환',
    squeeze_momentum_bearish: 'Squeeze 음전환',
};

interface SignalBadgeProps {
    type: SignalType;
}

/**
 * 라벨 대부분이 한글이라 uppercase는 효과가 없고, `tracking-wider`(0.05em)는
 * 라틴 소문자 기준 값이라 한글 자모를 흩뜨린다. 10px은 이 페이지에서 가장 많이
 * 반복되는 텍스트치고 지나치게 작아 12px로 올린다.
 *
 * **다만 라벨이 전부 한글인 것은 아니다.** 37개 중 9개에 라틴 낱말이 섞여 있어
 * uppercase를 걷어내면 5종의 보이는 표기가 바뀐다 —
 * `SUPERTREND 전환` → `Supertrend 전환`, `ICHIMOKU`·`PARABOLIC SAR`·`KELTNER`·
 * `SQUEEZE`도 같다. 사라지는 낱말은 없고 대소문자만 달라진다.
 *
 * 이 변화를 되돌리지 않는 이유: 이들은 약어가 아니라 지표의 **고유명**이라
 * 원래 표기가 `Supertrend`·`Ichimoku`다. 반면 같은 목록의 `RSI`·`MACD`·`CCI`·
 * `DMI`·`CMF`·`MFI`는 진짜 약어라 소스에 이미 대문자로 적혀 있고 그대로 남는다.
 * 즉 지금 조판이 이전의 일괄 대문자보다 정확하다.
 */
export function SignalBadge({ type }: SignalBadgeProps) {
    return (
        <span className="text-xs text-secondary-300">
            {SIGNAL_BADGE_LABELS[type]}
        </span>
    );
}
