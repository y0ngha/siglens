import { signalTypeToTagLabel, TAG_LABEL_MAP } from '@/domain/backtest/tags';

describe('signalTypeToTagLabel', () => {
    describe('매핑된 type은 해당 라벨을 반환한다', () => {
        it.each(Object.entries(TAG_LABEL_MAP))(
            '%s → %s',
            (type, expected) => {
                expect(signalTypeToTagLabel(type)).toBe(expected);
            }
        );
    });

    describe('매핑 완전성 검증 (모든 ConfirmedSignalType 및 anticipation bullish)', () => {
        it.each([
            // Confirmed bullish (pre-existing + Task 4-12)
            'rsi_oversold',
            'golden_cross',
            'macd_bullish_cross',
            'bollinger_lower_bounce',
            'supertrend_bullish_flip',
            'ichimoku_cloud_breakout',
            'cci_bullish_cross',
            'dmi_bullish_cross',
            'cmf_bullish_flip',
            'mfi_oversold_bounce',
            'parabolic_sar_flip',
            'keltner_upper_breakout',
            'squeeze_momentum_bullish',
            // Anticipation bullish
            'rsi_bullish_divergence',
            'macd_histogram_bullish_convergence',
            'bollinger_squeeze_bullish',
            'support_proximity_bullish',
        ])('%s 는 TAG_LABEL_MAP에 존재해야 한다', type => {
            expect(TAG_LABEL_MAP).toHaveProperty(type);
        });
    });

    describe('알 수 없는 타입', () => {
        it('fallback으로 타입 문자열 자체를 반환한다', () => {
            const unknownType = 'unknown_signal_xyz';
            expect(signalTypeToTagLabel(unknownType)).toBe(unknownType);
        });
    });
});
