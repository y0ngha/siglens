import {
    getSinglePatternTrend,
    getMultiPatternTrend,
    EXCLUDED_SINGLE_PATTERNS,
} from '@/domain/analysis/candle-trend';
import type { PatternTrend } from '@/domain/analysis/candle-trend';
import type {
    CandlePattern,
    MultiCandlePattern,
} from '@/domain/analysis/candle';

describe('candle-trend', () => {
    describe('getSinglePatternTrend', () => {
        it('bullish 패턴에 대해 bullish를 반환한다', () => {
            const bullishPatterns: CandlePattern[] = [
                'hammer',
                'inverted_hammer',
                'bullish_marubozu',
                'bullish_belt_hold',
                'dragonfly_doji',
            ];
            const results: PatternTrend[] = bullishPatterns.map(
                getSinglePatternTrend
            );
            results.forEach(trend => {
                expect(trend).toBe('bullish');
            });
        });

        it('bearish 패턴에 대해 bearish를 반환한다', () => {
            const bearishPatterns: CandlePattern[] = [
                'shooting_star',
                'hanging_man',
                'bearish_marubozu',
                'bearish_belt_hold',
                'gravestone_doji',
            ];
            const results: PatternTrend[] = bearishPatterns.map(
                getSinglePatternTrend
            );
            results.forEach(trend => {
                expect(trend).toBe('bearish');
            });
        });

        it('분류되지 않은 패턴에 대해 neutral을 반환한다', () => {
            const neutralPatterns: CandlePattern[] = [
                'doji',
                'spinning_top',
                'bullish',
                'bearish',
                'flat',
            ];
            const results: PatternTrend[] = neutralPatterns.map(
                getSinglePatternTrend
            );
            results.forEach(trend => {
                expect(trend).toBe('neutral');
            });
        });
    });

    describe('getMultiPatternTrend', () => {
        it('bullish 다봉 패턴에 대해 bullish를 반환한다', () => {
            const bullishPatterns: MultiCandlePattern[] = [
                'bullish_engulfing',
                'morning_star',
                'three_white_soldiers',
                'tweezers_bottom',
            ];
            const results: PatternTrend[] =
                bullishPatterns.map(getMultiPatternTrend);
            results.forEach(trend => {
                expect(trend).toBe('bullish');
            });
        });

        it('bearish 다봉 패턴에 대해 bearish를 반환한다', () => {
            const bearishPatterns: MultiCandlePattern[] = [
                'bearish_engulfing',
                'evening_star',
                'three_black_crows',
                'tweezers_top',
            ];
            const results: PatternTrend[] =
                bearishPatterns.map(getMultiPatternTrend);
            results.forEach(trend => {
                expect(trend).toBe('bearish');
            });
        });

        it('분류되지 않은 다봉 패턴에 대해 neutral을 반환한다', () => {
            const neutralPatterns: MultiCandlePattern[] = [
                'upside_gap_tasuki',
                'downside_gap_tasuki',
                'on_neck',
                'in_neck',
            ];
            const results: PatternTrend[] =
                neutralPatterns.map(getMultiPatternTrend);
            results.forEach(trend => {
                expect(trend).toBe('neutral');
            });
        });
    });

    describe('EXCLUDED_SINGLE_PATTERNS', () => {
        it('기본 형태 패턴이 제외 대상에 포함된다', () => {
            expect(EXCLUDED_SINGLE_PATTERNS.has('bullish')).toBe(true);
            expect(EXCLUDED_SINGLE_PATTERNS.has('bearish')).toBe(true);
            expect(EXCLUDED_SINGLE_PATTERNS.has('flat')).toBe(true);
            expect(EXCLUDED_SINGLE_PATTERNS.has('spinning_top')).toBe(true);
        });

        it('특수 패턴은 제외 대상에 포함되지 않는다', () => {
            expect(EXCLUDED_SINGLE_PATTERNS.has('hammer')).toBe(false);
            expect(EXCLUDED_SINGLE_PATTERNS.has('doji')).toBe(false);
        });
    });
});
