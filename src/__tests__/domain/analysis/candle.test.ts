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

    describe('3봉 패턴', () => {
        it('긴 음봉 + 갭다운 소봉 + 중심 돌파 양봉이면 morning_star를 반환한다', () => {
            // a: long bearish (open=110, close=100, body=10, range=12)
            // b: small bullish gap below a (open=97, close=98, bodyHigh=98 < bodyLow(a)=100)
            // c: bullish, close > midpoint(a)=105
            const a = makeBar(110, 111, 99, 100);
            const b = makeBar(97, 99, 96, 98);
            const c = makeBar(99, 108, 98, 107);
            expect(detectMultiCandlePattern([a, b, c])).toBe('morning_star');
        });

        it('3연속 긴 양봉이면 three_white_soldiers를 반환한다', () => {
            // a: open=100, close=108 (body=8, range=10)
            // b: open=103(>a.open, <a.close), close=113 (body=10, range=12)
            // c: open=108(>b.open, <b.close), close=119 (body=11, range=13)
            const a = makeBar(100, 109, 99, 108);
            const b = makeBar(103, 114, 102, 113);
            const c = makeBar(108, 120, 107, 119);
            expect(detectMultiCandlePattern([a, b, c])).toBe(
                'three_white_soldiers'
            );
        });
    });
});
