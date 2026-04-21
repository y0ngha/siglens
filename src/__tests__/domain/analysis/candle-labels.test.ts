import {
    CANDLE_PATTERN_LABELS,
    findCandlePatternLabel,
    getCandlePatternLabel,
    getMultiCandlePatternLabel,
    MULTI_CANDLE_PATTERN_LABELS,
} from '@/domain/analysis/candle-labels';
import type {
    CandlePattern,
    MultiCandlePattern,
} from '@/domain/analysis/candle';

const ALL_CANDLE_PATTERNS: CandlePattern[] = [
    'flat',
    'gravestone_doji',
    'dragonfly_doji',
    'doji',
    'bullish_marubozu',
    'bearish_marubozu',
    'shooting_star',
    'inverted_hammer',
    'hammer',
    'hanging_man',
    'bullish_belt_hold',
    'bearish_belt_hold',
    'spinning_top',
    'bullish',
    'bearish',
];

const ALL_MULTI_CANDLE_PATTERNS: MultiCandlePattern[] = [
    'bullish_engulfing',
    'bullish_harami',
    'bullish_harami_cross',
    'piercing_line',
    'bullish_counterattack_line',
    'morning_star',
    'morning_doji_star',
    'bullish_abandoned_baby',
    'three_white_soldiers',
    'three_inside_up',
    'three_outside_up',
    'bullish_triple_star',
    'ladder_bottom',
    'tweezers_bottom',
    'downside_gap_two_rabbits',
    'bearish_engulfing',
    'bearish_harami',
    'bearish_harami_cross',
    'dark_cloud_cover',
    'bearish_counterattack_line',
    'evening_star',
    'evening_doji_star',
    'bearish_abandoned_baby',
    'three_black_crows',
    'three_inside_down',
    'three_outside_down',
    'bearish_triple_star',
    'advance_block',
    'tweezers_top',
    'upside_gap_two_crows',
    'upside_gap_tasuki',
    'downside_gap_tasuki',
    'on_neck',
    'in_neck',
];

describe('candle-labels', () => {
    describe('CANDLE_PATTERN_LABELS', () => {
        it('모든 CandlePattern 키에 대해 한국어 레이블이 정의되어 있다', () => {
            ALL_CANDLE_PATTERNS.forEach(pattern => {
                expect(CANDLE_PATTERN_LABELS[pattern]).toBeDefined();
            });
        });

        it('모든 레이블이 빈 문자열이 아니다', () => {
            ALL_CANDLE_PATTERNS.forEach(pattern => {
                expect(CANDLE_PATTERN_LABELS[pattern].length).toBeGreaterThan(
                    0
                );
            });
        });

        it('"hammer"는 "망치형"을 반환한다', () => {
            expect(CANDLE_PATTERN_LABELS['hammer']).toBe('망치형');
        });

        it('"doji"는 "도지"를 반환한다', () => {
            expect(CANDLE_PATTERN_LABELS['doji']).toBe('도지');
        });

        it('"bullish"는 "양봉"을 반환한다', () => {
            expect(CANDLE_PATTERN_LABELS['bullish']).toBe('양봉');
        });

        it('"bearish"는 "음봉"을 반환한다', () => {
            expect(CANDLE_PATTERN_LABELS['bearish']).toBe('음봉');
        });
    });

    describe('MULTI_CANDLE_PATTERN_LABELS', () => {
        it('모든 MultiCandlePattern 키에 대해 한국어 레이블이 정의되어 있다', () => {
            ALL_MULTI_CANDLE_PATTERNS.forEach(pattern => {
                expect(MULTI_CANDLE_PATTERN_LABELS[pattern]).toBeDefined();
            });
        });

        it('모든 레이블이 빈 문자열이 아니다', () => {
            ALL_MULTI_CANDLE_PATTERNS.forEach(pattern => {
                expect(
                    MULTI_CANDLE_PATTERN_LABELS[pattern].length
                ).toBeGreaterThan(0);
            });
        });

        it('"bullish_engulfing"은 "상승 장악형"을 반환한다', () => {
            expect(MULTI_CANDLE_PATTERN_LABELS['bullish_engulfing']).toBe(
                '상승 장악형'
            );
        });

        it('"morning_star"는 "샛별형"을 반환한다', () => {
            expect(MULTI_CANDLE_PATTERN_LABELS['morning_star']).toBe('샛별형');
        });

        it('"three_white_soldiers"는 "적삼병"을 반환한다', () => {
            expect(MULTI_CANDLE_PATTERN_LABELS['three_white_soldiers']).toBe(
                '적삼병'
            );
        });

        it('"three_black_crows"는 "흑삼병"을 반환한다', () => {
            expect(MULTI_CANDLE_PATTERN_LABELS['three_black_crows']).toBe(
                '흑삼병'
            );
        });
    });

    describe('getCandlePatternLabel', () => {
        it('CandlePattern 값에 해당하는 한국어 문자열을 반환한다', () => {
            expect(getCandlePatternLabel('hammer')).toBe('망치형');
            expect(getCandlePatternLabel('doji')).toBe('도지');
            expect(getCandlePatternLabel('bullish')).toBe('양봉');
            expect(getCandlePatternLabel('bearish')).toBe('음봉');
        });

        it('반환값이 비어있지 않다', () => {
            ALL_CANDLE_PATTERNS.forEach(pattern => {
                expect(getCandlePatternLabel(pattern).length).toBeGreaterThan(
                    0
                );
            });
        });
    });

    describe('getMultiCandlePatternLabel', () => {
        it('MultiCandlePattern 값에 해당하는 한국어 문자열을 반환한다', () => {
            expect(getMultiCandlePatternLabel('bullish_engulfing')).toBe(
                '상승 장악형'
            );
            expect(getMultiCandlePatternLabel('morning_star')).toBe('샛별형');
            expect(getMultiCandlePatternLabel('three_white_soldiers')).toBe(
                '적삼병'
            );
            expect(getMultiCandlePatternLabel('three_black_crows')).toBe(
                '흑삼병'
            );
        });

        it('반환값이 비어있지 않다', () => {
            ALL_MULTI_CANDLE_PATTERNS.forEach(pattern => {
                expect(
                    getMultiCandlePatternLabel(pattern).length
                ).toBeGreaterThan(0);
            });
        });
    });

    describe('findCandlePatternLabel', () => {
        it('단일 캔들 패턴 이름에 해당하는 한국어 레이블을 반환한다', () => {
            expect(findCandlePatternLabel('hammer')).toBe('망치형');
            expect(findCandlePatternLabel('doji')).toBe('도지');
        });

        it('복합 캔들 패턴 이름에 해당하는 한국어 레이블을 반환한다', () => {
            expect(findCandlePatternLabel('bullish_engulfing')).toBe(
                '상승 장악형'
            );
            expect(findCandlePatternLabel('morning_star')).toBe('샛별형');
        });

        it('알 수 없는 패턴 이름은 입력값을 그대로 반환한다', () => {
            expect(findCandlePatternLabel('unknown_pattern')).toBe(
                'unknown_pattern'
            );
        });
    });
});
