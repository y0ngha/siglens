import {
    detectCandlePattern,
    detectMultiCandlePattern,
} from '@/domain/analysis/candle';
import type { Bar } from '@/domain/types';

const makeBar = (
    open: number,
    high: number,
    low: number,
    close: number
): Bar => ({ time: 0, open, high, low, close, volume: 0 });

// flat: highLowRange === 0
const FLAT_BAR = makeBar(100, 100, 100, 100);

// doji: bodySize=0.5, range=20, bodyRatio=0.025 (≤0.1)
const DOJI_BAR = makeBar(100, 110, 90, 100.5);

// bullish_marubozu: bodySize=10, range=10, bodyRatio=1.0 (≥0.9), bullish
const BULLISH_MARUBOZU_BAR = makeBar(100, 110, 100, 110);

// bearish_marubozu: same structure, bearish
const BEARISH_MARUBOZU_BAR = makeBar(110, 110, 100, 100);

// shooting_star: open=100,close=97,high=115,low=96
//   bodySize=3, range=19, bodyRatio≈0.158
//   upperShadow=15(≥3*2=6), lowerShadow=1(≤3*1=3), bearish
const SHOOTING_STAR_BAR = makeBar(100, 115, 96, 97);

// inverted_hammer: same shape, bullish
const INVERTED_HAMMER_BAR = makeBar(97, 115, 96, 100);

// hammer: open=100,close=103,high=105,low=85
//   bodySize=3, range=20, bodyRatio=0.15
//   lowerShadow=15(≥3*2=6), upperShadow=2(≤3*1=3), bullish
const HAMMER_BAR = makeBar(100, 105, 85, 103);

// hanging_man: same shape, bearish
const HANGING_MAN_BAR = makeBar(103, 105, 85, 100);

// gravestone_doji: open=100,close=100.5,high=120,low=100
//   body=0.5, range=20, bodyRatio=0.025(≤0.1), lowerShadow=0(≤range*0.1=2)
const GRAVESTONE_DOJI_BAR = makeBar(100, 120, 100, 100.5);

// dragonfly_doji: open=100.5,close=100,high=101,low=80
//   body=0.5, range=21, bodyRatio≈0.024(≤0.1), upperShadow=1(≤range*0.1=2.1)
const DRAGONFLY_DOJI_BAR = makeBar(100.5, 101, 80, 100);

// spinning_top: open=100,close=103,high=110,low=93
//   body=3, range=17, bodyRatio≈0.176 (0.1<x≤0.4), upper=7, lower=7
//   hasLongUpper(7≥6)=true, hasShortLower(7≤3)=false → not shooting_star
//   hasLongLower(7≥6)=true, hasShortUpper(7≤3)=false → not hammer
const SPINNING_TOP_BAR = makeBar(100, 110, 93, 103);

// bullish_belt_hold: open=100,close=110,high=112,low=99
//   body=10, range=13, bodyRatio≈0.769(≥0.6), bullish, lowerShadow=1(≤body*0.1=1)
const BULLISH_BELT_HOLD_BAR = makeBar(100, 112, 99, 110);

// bearish_belt_hold: open=110,close=100,high=111,low=98
//   body=10, range=13, bodyRatio≈0.769(≥0.6), bearish, upperShadow=1(≤body*0.1=1)
const BEARISH_BELT_HOLD_BAR = makeBar(110, 111, 98, 100);

// regular bullish: open=100,close=105,high=107,low=98
//   bodySize=5, range=9, bodyRatio≈0.556
//   no long shadow conditions met
const BULLISH_BAR = makeBar(100, 107, 98, 105);

// regular bearish
const BEARISH_BAR = makeBar(105, 107, 98, 100);

describe('detectCandlePattern', () => {
    describe('flat', () => {
        it('high === low이면 flat을 반환한다', () => {
            expect(detectCandlePattern(FLAT_BAR)).toBe('flat');
        });
    });

    describe('doji', () => {
        it('몸통이 전체 범위의 10% 이하이면 doji를 반환한다', () => {
            expect(detectCandlePattern(DOJI_BAR)).toBe('doji');
        });
    });

    describe('marubozu', () => {
        it('꼬리 없는 양봉은 bullish_marubozu를 반환한다', () => {
            expect(detectCandlePattern(BULLISH_MARUBOZU_BAR)).toBe(
                'bullish_marubozu'
            );
        });

        it('꼬리 없는 음봉은 bearish_marubozu를 반환한다', () => {
            expect(detectCandlePattern(BEARISH_MARUBOZU_BAR)).toBe(
                'bearish_marubozu'
            );
        });
    });

    describe('shooting_star / inverted_hammer', () => {
        it('긴 위꼬리 + 짧은 아래꼬리 + 음봉은 shooting_star를 반환한다', () => {
            expect(detectCandlePattern(SHOOTING_STAR_BAR)).toBe(
                'shooting_star'
            );
        });

        it('긴 위꼬리 + 짧은 아래꼬리 + 양봉은 inverted_hammer를 반환한다', () => {
            expect(detectCandlePattern(INVERTED_HAMMER_BAR)).toBe(
                'inverted_hammer'
            );
        });
    });

    describe('hammer / hanging_man', () => {
        it('긴 아래꼬리 + 짧은 위꼬리 + 양봉은 hammer를 반환한다', () => {
            expect(detectCandlePattern(HAMMER_BAR)).toBe('hammer');
        });

        it('긴 아래꼬리 + 짧은 위꼬리 + 음봉은 hanging_man을 반환한다', () => {
            expect(detectCandlePattern(HANGING_MAN_BAR)).toBe('hanging_man');
        });
    });

    describe('bullish / bearish', () => {
        it('조건에 해당하지 않는 양봉은 bullish를 반환한다', () => {
            expect(detectCandlePattern(BULLISH_BAR)).toBe('bullish');
        });

        it('조건에 해당하지 않는 음봉은 bearish를 반환한다', () => {
            expect(detectCandlePattern(BEARISH_BAR)).toBe('bearish');
        });
    });

    describe('gravestone_doji / dragonfly_doji', () => {
        it('몸통이 10% 이하이고 아래꼬리가 거의 없으면 gravestone_doji를 반환한다', () => {
            expect(detectCandlePattern(GRAVESTONE_DOJI_BAR)).toBe(
                'gravestone_doji'
            );
        });

        it('몸통이 10% 이하이고 위꼬리가 거의 없으면 dragonfly_doji를 반환한다', () => {
            expect(detectCandlePattern(DRAGONFLY_DOJI_BAR)).toBe(
                'dragonfly_doji'
            );
        });
    });

    describe('spinning_top', () => {
        it('작은 몸통에 양쪽 꼬리가 있으면 spinning_top을 반환한다', () => {
            expect(detectCandlePattern(SPINNING_TOP_BAR)).toBe('spinning_top');
        });
    });

    describe('belt_hold', () => {
        it('긴 양봉 몸통에 아래꼬리가 거의 없으면 bullish_belt_hold를 반환한다', () => {
            expect(detectCandlePattern(BULLISH_BELT_HOLD_BAR)).toBe(
                'bullish_belt_hold'
            );
        });

        it('긴 음봉 몸통에 위꼬리가 거의 없으면 bearish_belt_hold를 반환한다', () => {
            expect(detectCandlePattern(BEARISH_BELT_HOLD_BAR)).toBe(
                'bearish_belt_hold'
            );
        });
    });
});

describe('detectMultiCandlePattern', () => {
    describe('봉 수 부족', () => {
        it('봉이 1개이면 null을 반환한다', () => {
            expect(
                detectMultiCandlePattern([makeBar(100, 105, 95, 102)])
            ).toBeNull();
        });
    });

    describe('2봉 패턴', () => {
        describe('engulfing', () => {
            it('음봉 후 포함하는 양봉이면 bullish_engulfing을 반환한다', () => {
                // prev: bearish (open=105, close=100)
                // curr: bullish engulfing (open=99, close=107)
                const prev = makeBar(105, 106, 99, 100);
                const curr = makeBar(99, 108, 98, 107);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bullish_engulfing'
                );
            });

            it('양봉 후 포함하는 음봉이면 bearish_engulfing을 반환한다', () => {
                // prev: bullish (open=100, close=105)
                // curr: bearish engulfing (open=106, close=98)
                const prev = makeBar(100, 106, 99, 105);
                const curr = makeBar(106, 107, 97, 98);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bearish_engulfing'
                );
            });
        });

        describe('harami', () => {
            it('긴 음봉 후 몸통 안에 드는 비도지 봉이면 bullish_harami를 반환한다', () => {
                // prev: long bearish (body=10, range=12)
                // curr: inside body, not doji (body=2, range=4, ratio=0.5)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(103, 106, 102, 105);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bullish_harami'
                );
            });

            it('긴 음봉 후 몸통 안에 드는 도지 봉이면 bullish_harami_cross를 반환한다', () => {
                // curr: doji inside prev body (body=0.2, range=4, ratio=0.05)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(103, 107, 99, 103.2);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bullish_harami_cross'
                );
            });

            it('긴 양봉 후 몸통 안에 드는 비도지 봉이면 bearish_harami를 반환한다', () => {
                // prev: long bullish (body=10, range=12)
                // curr: inside body, bearish, not doji (body=2, range=4)
                const prev = makeBar(100, 111, 99, 110);
                const curr = makeBar(109, 110, 104, 105);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bearish_harami'
                );
            });

            it('긴 양봉 후 몸통 안에 드는 도지 봉이면 bearish_harami_cross를 반환한다', () => {
                // curr: doji inside prev body (body=0.3, range=6, ratio=0.05)
                const prev = makeBar(100, 111, 99, 110);
                const curr = makeBar(105, 108, 102, 105.3);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bearish_harami_cross'
                );
            });
        });

        describe('piercing_line / dark_cloud_cover', () => {
            it('긴 음봉 후 중점 돌파 양봉이면 piercing_line을 반환한다', () => {
                // prev: long bearish (body=10, range=12), midpoint=105
                // curr: open<prev.close(100), close>midpoint(105) && close<prev.open(110)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(98, 108, 97, 107);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'piercing_line'
                );
            });

            it('긴 양봉 후 중점 하락 음봉이면 dark_cloud_cover를 반환한다', () => {
                // prev: long bullish (body=10, range=12), midpoint=105
                // curr: open>prev.close(110), close<midpoint(105) && close>prev.open(100)
                const prev = makeBar(100, 111, 99, 110);
                const curr = makeBar(112, 113, 102, 103);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'dark_cloud_cover'
                );
            });
        });

        describe('counterattack_line', () => {
            it('긴 음봉 후 종가가 거의 같은 긴 양봉이면 bullish_counterattack_line을 반환한다', () => {
                // prev: long bearish, prev.close=100
                // curr: long bullish, curr.close≈100 (within 0.2%)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(90, 101, 89, 100.1);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bullish_counterattack_line'
                );
            });

            it('긴 양봉 후 종가가 거의 같은 긴 음봉이면 bearish_counterattack_line을 반환한다', () => {
                // prev: long bullish, prev.close=110
                // curr: long bearish, curr.close≈110 (within 0.2%)
                const prev = makeBar(100, 111, 99, 110);
                const curr = makeBar(120, 121, 109, 110.1);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'bearish_counterattack_line'
                );
            });
        });

        describe('tweezers', () => {
            it('직전 음봉과 저가가 거의 같으면 tweezers_bottom을 반환한다', () => {
                // prev: bearish, prev.low=90 / curr: bullish, curr.low=90
                const prev = makeBar(105, 106, 90, 100);
                const curr = makeBar(90, 97, 90, 95);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'tweezers_bottom'
                );
            });

            it('직전 양봉과 고가가 거의 같으면 tweezers_top을 반환한다', () => {
                // prev: bullish, prev.high=110 / curr: bearish, curr.high=110
                const prev = makeBar(100, 110, 99, 105);
                const curr = makeBar(108, 110, 102, 103);
                expect(detectMultiCandlePattern([prev, curr])).toBe(
                    'tweezers_top'
                );
            });
        });

        describe('on_neck / in_neck', () => {
            it('긴 음봉 후 저가 밑에서 시작해 저가 근처에서 마감하면 on_neck을 반환한다', () => {
                // prev: long bearish, prev.low=99
                // curr: open<99, close≈99 (within 0.2%)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(97, 100, 96, 99.1);
                expect(detectMultiCandlePattern([prev, curr])).toBe('on_neck');
            });

            it('긴 음봉 후 저가 밑에서 시작해 전일 종가 5% 이내에서 마감하면 in_neck을 반환한다', () => {
                // prev: long bearish, prev.low=99, prev.close=100
                // curr: open<99, close>99 && close<105(=100*1.05), NOT isNearPrice(close, 99)
                const prev = makeBar(110, 111, 99, 100);
                const curr = makeBar(97, 103, 96, 100.5);
                expect(detectMultiCandlePattern([prev, curr])).toBe('in_neck');
            });
        });

        describe('null 반환', () => {
            it('어떤 2봉 패턴에도 해당하지 않으면 null을 반환한다', () => {
                // both small bullish bars with no relation
                const prev = makeBar(100, 103, 99, 102);
                const curr = makeBar(101, 104, 100, 103);
                expect(detectMultiCandlePattern([prev, curr])).toBeNull();
            });
        });
    });

    describe('3봉 패턴', () => {
        describe('three_white_soldiers / three_black_crows', () => {
            it('3연속 긴 양봉이면 three_white_soldiers를 반환한다', () => {
                // a: body=8, range=10 / b: open in a's body / c: open in b's body
                const a = makeBar(100, 109, 99, 108);
                const b = makeBar(103, 114, 102, 113);
                const c = makeBar(108, 120, 107, 119);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_white_soldiers'
                );
            });

            it('3연속 긴 음봉이면 three_black_crows를 반환한다', () => {
                // a: body=10, range=12 / b: open in a's body / c: open in b's body
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(105, 106, 92, 93);
                const c = makeBar(98, 99, 86, 87);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_black_crows'
                );
            });
        });

        describe('morning_star / morning_doji_star', () => {
            it('긴 음봉 + 갭다운 소봉 + 중심 돌파 양봉이면 morning_star를 반환한다', () => {
                // a: long bearish (body=10, range=12), midpoint=105
                // b: small non-doji gap below a (bodyHigh=98 < bodyLow(a)=100)
                // c: bullish, close(107) > midpoint(105)
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(97, 99, 96, 98);
                const c = makeBar(99, 108, 98, 107);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'morning_star'
                );
            });

            it('긴 음봉 + 갭다운 도지 + 중심 돌파 양봉이면 morning_doji_star를 반환한다', () => {
                // b: doji (body=0.2, range=4, ratio=0.05)
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(97, 99, 95, 97.2);
                const c = makeBar(99, 108, 98, 107);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'morning_doji_star'
                );
            });
        });

        describe('evening_star / evening_doji_star', () => {
            it('긴 양봉 + 갭업 소봉 + 중심 하락 음봉이면 evening_star를 반환한다', () => {
                // a: long bullish (body=10, range=12), midpoint=105
                // b: non-doji gap above a (bodyLow=113 > bodyHigh(a)=110)
                // c: bearish, close(103) < midpoint(105)
                const a = makeBar(100, 111, 99, 110);
                const b = makeBar(113, 116, 112, 115);
                const c = makeBar(109, 110, 102, 103);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'evening_star'
                );
            });

            it('긴 양봉 + 갭업 도지 + 중심 하락 음봉이면 evening_doji_star를 반환한다', () => {
                // b: doji (body=0.3, range=4, ratio=0.075)
                const a = makeBar(100, 111, 99, 110);
                const b = makeBar(113, 116, 112, 113.3);
                const c = makeBar(109, 110, 102, 103);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'evening_doji_star'
                );
            });
        });

        describe('abandoned_baby', () => {
            it('긴 음봉 + 갭다운 도지 + 갭업 양봉이면 bullish_abandoned_baby를 반환한다', () => {
                // a: long bearish, a.low=99
                // b: doji, b.high=97 < a.low=99 (gapDown)
                // c: bullish, c.low=98 > b.high=97 (gapUp)
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(95, 97, 93, 95.2);
                const c = makeBar(99, 106, 98, 105);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'bullish_abandoned_baby'
                );
            });

            it('긴 양봉 + 갭업 도지 + 갭다운 음봉이면 bearish_abandoned_baby를 반환한다', () => {
                // a: long bullish (body=10, range=12), midpoint(a)=105
                // b: doji, b.low=113 > a.high=111 (gapUp)
                // c: bearish, c.high=112 < b.low=113 (gapDown)
                //   c.close(106) >= midpoint(a)(105) → evening_doji_star 조건 불충족
                const a = makeBar(100, 111, 99, 110);
                const b = makeBar(114, 116, 113, 114.2);
                const c = makeBar(108, 112, 105, 106);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'bearish_abandoned_baby'
                );
            });
        });

        describe('three_inside', () => {
            it('긴 음봉 + 내부 양봉 + 확인 양봉이면 three_inside_up을 반환한다', () => {
                // a: long bearish, a.open=110
                // b: bullish inside a (bodyLow=101≥100, bodyHigh=105≤110)
                // c: bullish, c.close(112) > a.open(110)
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(101, 106, 100, 105);
                const c = makeBar(103, 113, 102, 112);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_inside_up'
                );
            });

            it('긴 양봉 + 내부 음봉 + 확인 음봉이면 three_inside_down을 반환한다', () => {
                // a: long bullish, a.open=100
                // b: bearish inside a (bodyLow=105≥100, bodyHigh=109≤110)
                // c: bearish, c.close(98) < a.open(100)
                const a = makeBar(100, 111, 99, 110);
                const b = makeBar(109, 110, 104, 105);
                const c = makeBar(107, 108, 97, 98);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_inside_down'
                );
            });
        });

        describe('three_outside', () => {
            it('음봉 + 포함 양봉 + 확인 양봉이면 three_outside_up을 반환한다', () => {
                // a: bearish (a.open=105, a.close=100)
                // b: bullish engulfing (b.close≥a.open=105, b.open≤a.close=100)
                // c: bullish, c.close(110) > b.close(107)
                const a = makeBar(105, 106, 99, 100);
                const b = makeBar(99, 108, 98, 107);
                const c = makeBar(105, 111, 104, 110);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_outside_up'
                );
            });

            it('양봉 + 포함 음봉 + 확인 음봉이면 three_outside_down을 반환한다', () => {
                // a: bullish (a.open=100, a.close=105)
                // b: bearish engulfing (b.close≤a.open=100, b.open≥a.close=105)
                // c: bearish, c.close(95) < b.close(98)
                const a = makeBar(100, 106, 99, 105);
                const b = makeBar(106, 107, 97, 98);
                const c = makeBar(100, 101, 94, 95);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'three_outside_down'
                );
            });
        });

        describe('triple_star', () => {
            it('3도지 + 갭다운 + 마지막 양봉이면 bullish_triple_star를 반환한다', () => {
                // a: doji (body=0.5, range=10, ratio=0.05), a.low=95
                // b: doji, b.high=93 < a.low=95 (gapDown)
                // c: bullish doji
                const a = makeBar(100, 105, 95, 100.5);
                const b = makeBar(91, 93, 89, 91.3);
                const c = makeBar(90, 92, 88, 90.3);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'bullish_triple_star'
                );
            });

            it('3도지 + 갭업 + 마지막 음봉이면 bearish_triple_star를 반환한다', () => {
                // a: doji (body=0.5, range=10), a.high=105
                // b: doji, b.low=107 > a.high=105 (gapUp)
                // c: bearish doji
                const a = makeBar(100, 105, 95, 100.5);
                const b = makeBar(108, 110, 107, 108.3);
                const c = makeBar(107, 109, 105, 106.7);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'bearish_triple_star'
                );
            });
        });

        describe('gap_two', () => {
            it('긴 양봉 + 갭업 후 두 음봉이 하락하면 upside_gap_two_crows를 반환한다', () => {
                // a: long bullish, bodyHigh(a)=108
                // b: bearish, bodyLow(b)=112 > 108
                // c: bearish, c.open(113)≤b.open(115), c.close(110)≤b.close(112), c.open(113)>108
                const a = makeBar(100, 109, 99, 108);
                const b = makeBar(115, 116, 111, 112);
                const c = makeBar(113, 114, 109, 110);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'upside_gap_two_crows'
                );
            });

            it('긴 음봉 + 갭다운 후 두 양봉이 상승하면 downside_gap_two_rabbits를 반환한다', () => {
                // a: long bearish, bodyLow(a)=102
                // b: bullish, bodyHigh(b)=99 < 102
                // c: bullish, c.open(97)≥b.open(96), c.close(100)≥b.close(99), c.open(97)<102
                const a = makeBar(110, 111, 101, 102);
                const b = makeBar(96, 100, 95, 99);
                const c = makeBar(97, 101, 96, 100);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'downside_gap_two_rabbits'
                );
            });
        });

        describe('advance_block', () => {
            it('3연속 양봉이나 몸통 줄고 위꼬리 늘면 advance_block을 반환한다', () => {
                // a: long bullish (body=8, range=10), upperShadow=1
                // b: bullish (body=6<8, range=12), upperShadow=5>1
                // c: bullish (body=4<6, range=14), upperShadow=9>5
                const a = makeBar(100, 109, 99, 108);
                const b = makeBar(102, 113, 101, 108);
                const c = makeBar(104, 117, 103, 108);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'advance_block'
                );
            });
        });

        describe('gap_tasuki', () => {
            it('갭업 후 두 양봉 사이 음봉이면 upside_gap_tasuki를 반환한다', () => {
                // a: bullish, a.high=108
                // b: bullish, b.low=109 > a.high=108 (gapUp)
                // c: bearish, c.open(113)<b.close(115), c.close(110)>a.high(108)
                const a = makeBar(100, 108, 99, 107);
                const b = makeBar(110, 116, 109, 115);
                const c = makeBar(113, 114, 109, 110);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'upside_gap_tasuki'
                );
            });

            it('갭다운 후 두 음봉 사이 양봉이면 downside_gap_tasuki를 반환한다', () => {
                // a: bearish, a.low=102
                // b: bearish, b.high=101 < a.low=102 (gapDown)
                // c: bullish, c.open(97)>b.close(95), c.close(100)<a.low(102)
                const a = makeBar(110, 111, 102, 103);
                const b = makeBar(100, 101, 94, 95);
                const c = makeBar(97, 101, 96, 100);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'downside_gap_tasuki'
                );
            });
        });

        describe('ladder_bottom', () => {
            it('두 음봉 하락 후 긴 음봉 상단에서 양봉이면 ladder_bottom을 반환한다', () => {
                // a: bearish (a.open=110, a.close=100)
                // b: long bearish (body=13, range=15), b.open=108 (a.close<108<a.open)
                // c: bullish, c.open(110)>b.open(108), c.close(112)>a.open(110)
                const a = makeBar(110, 111, 99, 100);
                const b = makeBar(108, 109, 94, 95);
                const c = makeBar(110, 113, 109, 112);
                expect(detectMultiCandlePattern([a, b, c])).toBe(
                    'ladder_bottom'
                );
            });
        });

        describe('null 반환', () => {
            it('어떤 3봉 패턴에도 해당하지 않으면 2봉 패턴을 시도하고 없으면 null을 반환한다', () => {
                // 3봉도, 마지막 2봉도 패턴 없음
                const a = makeBar(100, 103, 99, 102);
                const b = makeBar(101, 104, 100, 103);
                const c = makeBar(102, 105, 101, 104);
                expect(detectMultiCandlePattern([a, b, c])).toBeNull();
            });
        });
    });
});
