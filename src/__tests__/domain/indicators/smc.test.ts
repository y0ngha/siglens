import { calculateSmc } from '@/domain/indicators/smc';
import {
    SMC_SWING_PERIOD,
    SMC_ATR_PERIOD,
} from '@/domain/indicators/constants';
import type { Bar, SMCResult } from '@/domain/types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBar(close: number, overrides: Partial<Bar> = {}, index = 0): Bar {
    return {
        time: index * 60,
        open: close,
        high: close + 5,
        low: close - 5,
        close,
        volume: 1000,
        ...overrides,
    };
}

function makeBars(
    values: { open?: number; high: number; low: number; close: number }[]
): Bar[] {
    return values.map((v, i) => ({
        time: i * 60,
        open: v.open ?? v.close,
        high: v.high,
        low: v.low,
        close: v.close,
        volume: 1000,
    }));
}

function makeUniformBars(count: number, price = 100): Bar[] {
    return Array.from({ length: count }, (_, i) =>
        makeBar(price, { high: price + 5, low: price - 5 }, i)
    );
}

/**
 * Build a realistic bar sequence that creates a bullish BOS:
 *   Phase 1 (uptrend) → swing high forms
 *   Phase 2 (pullback) → swing low forms, bearish trend established
 *   Phase 3 (breakout) → price closes above Phase 1 swing high → bullish BOS
 */
function makeBullishBreakSequence(): Bar[] {
    const phase1 = Array.from({ length: 10 }, (_, i) => ({
        time: i * 60,
        open: 100 + i * 4,
        high: 100 + i * 4 + 3,
        low: 100 + i * 4 - 3,
        close: 100 + i * 4 + 2,
        volume: 1000,
    }));
    const phase2 = Array.from({ length: 10 }, (_, i) => ({
        time: (10 + i) * 60,
        open: 138 - i * 4,
        high: 138 - i * 4 + 3,
        low: 138 - i * 4 - 3,
        close: 138 - i * 4 - 2,
        volume: 1000,
    }));
    // Phase 3: strong rally breaking above phase 1 peak (~140)
    const phase3 = Array.from({ length: 10 }, (_, i) => ({
        time: (20 + i) * 60,
        open: 102 + i * 6,
        high: 102 + i * 6 + 5,
        low: 102 + i * 6 - 2,
        close: 102 + i * 6 + 4,
        volume: 1000,
    }));
    return [...phase1, ...phase2, ...phase3];
}

/**
 * Build a realistic bar sequence that creates a bearish BOS:
 *   Phase 1 (downtrend) → swing low forms
 *   Phase 2 (bounce) → swing high forms, bullish trend established
 *   Phase 3 (breakdown) → price closes below Phase 1 swing low → bearish BOS
 */
function makeBearishBreakSequence(): Bar[] {
    const phase1 = Array.from({ length: 10 }, (_, i) => ({
        time: i * 60,
        open: 200 - i * 4,
        high: 200 - i * 4 + 3,
        low: 200 - i * 4 - 3,
        close: 200 - i * 4 - 2,
        volume: 1000,
    }));
    const phase2 = Array.from({ length: 10 }, (_, i) => ({
        time: (10 + i) * 60,
        open: 162 + i * 4,
        high: 162 + i * 4 + 3,
        low: 162 + i * 4 - 3,
        close: 162 + i * 4 + 2,
        volume: 1000,
    }));
    // Phase 3: sharp drop breaking below phase 1 trough (~160)
    const phase3 = Array.from({ length: 10 }, (_, i) => ({
        time: (20 + i) * 60,
        open: 198 - i * 6,
        high: 198 - i * 6 + 2,
        low: 198 - i * 6 - 5,
        close: 198 - i * 6 - 4,
        volume: 1000,
    }));
    return [...phase1, ...phase2, ...phase3];
}

const ENOUGH_BARS = SMC_SWING_PERIOD * 2 + SMC_ATR_PERIOD + 5;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateSmc', () => {
    describe('입력 배열이 비어있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = calculateSmc([]);
            expect(result.swingHighs).toEqual([]);
            expect(result.swingLows).toEqual([]);
            expect(result.orderBlocks).toEqual([]);
            expect(result.fairValueGaps).toEqual([]);
            expect(result.equalHighs).toEqual([]);
            expect(result.equalLows).toEqual([]);
            expect(result.structureBreaks).toEqual([]);
            expect(result.premiumZone).toBeNull();
            expect(result.discountZone).toBeNull();
            expect(result.equilibriumZone).toBeNull();
        });
    });

    describe('입력 배열 길이가 스윙 감지에 필요한 최소 길이보다 짧을 때', () => {
        it('스윙 포인트를 감지하지 못한다', () => {
            const bars = makeUniformBars(SMC_SWING_PERIOD * 2);
            const result = calculateSmc(bars);
            expect(result.swingHighs).toEqual([]);
            expect(result.swingLows).toEqual([]);
        });
    });

    describe('스윙 포인트 감지', () => {
        it('상승 후 하락하는 바 시퀀스에서 스윙 고점을 감지한다', () => {
            // Tip pattern: rises to a peak then falls
            const bars = makeBars([
                { high: 105, low: 95, close: 100 },
                { high: 110, low: 100, close: 105 },
                { high: 115, low: 105, close: 110 },
                { high: 120, low: 110, close: 115 }, // swing high candidate
                { high: 118, low: 108, close: 113 },
                { high: 115, low: 105, close: 110 },
                { high: 112, low: 102, close: 107 },
                { high: 109, low: 99, close: 104 },
                { high: 106, low: 96, close: 101 },
                { high: 103, low: 93, close: 98 },
                { high: 100, low: 90, close: 95 },
            ]);
            const result = calculateSmc(bars, 3);
            expect(result.swingHighs.length).toBeGreaterThan(0);
            const peak = result.swingHighs.find(s => s.price === 120);
            expect(peak).toBeDefined();
        });

        it('하락 후 상승하는 바 시퀀스에서 스윙 저점을 감지한다', () => {
            const bars = makeBars([
                { high: 115, low: 105, close: 110 },
                { high: 112, low: 102, close: 107 },
                { high: 109, low: 99, close: 104 },
                { high: 106, low: 94, close: 95 }, // swing low candidate
                { high: 108, low: 98, close: 103 },
                { high: 111, low: 101, close: 106 },
                { high: 114, low: 104, close: 109 },
                { high: 117, low: 107, close: 112 },
                { high: 120, low: 110, close: 115 },
                { high: 123, low: 113, close: 118 },
            ]);
            const result = calculateSmc(bars, 3);
            expect(result.swingLows.length).toBeGreaterThan(0);
            const trough = result.swingLows.find(s => s.price === 94);
            expect(trough).toBeDefined();
        });

        it('스윙 포인트의 index 필드는 bars 배열의 실제 인덱스다', () => {
            const bars = makeUniformBars(ENOUGH_BARS);
            const result = calculateSmc(bars);
            [...result.swingHighs, ...result.swingLows].forEach(s => {
                expect(s.index).toBeGreaterThanOrEqual(0);
                expect(s.index).toBeLessThan(bars.length);
            });
        });

        it('균일한 가격에서는 스윙 포인트를 감지한다', () => {
            // With uniform bars every candidate bar ties for max/min, so it IS the max/min
            const bars = makeUniformBars(ENOUGH_BARS, 100);
            const result = calculateSmc(bars);
            // At least one swing should be detected in a long enough uniform series
            // (ties are treated as valid maxima/minima)
            expect(
                result.swingHighs.length + result.swingLows.length
            ).toBeGreaterThan(0);
        });
    });

    describe('Fair Value Gap 감지', () => {
        it('상승 FVG를 감지한다', () => {
            // Bar i-2 high = 100, bar i low = 105 → bullish FVG
            const bars = makeBars([
                { high: 100, low: 90, close: 95 }, // i-2: high=100
                { high: 103, low: 93, close: 98 }, // i-1 (middle bar)
                { high: 112, low: 105, close: 110 }, // i: low=105 > 100
            ]);
            const result = calculateSmc(bars, 1);
            expect(result.fairValueGaps.length).toBe(1);
            expect(result.fairValueGaps[0].type).toBe('bullish');
            expect(result.fairValueGaps[0].low).toBe(100);
            expect(result.fairValueGaps[0].high).toBe(105);
        });

        it('하락 FVG를 감지한다', () => {
            // Bar i-2 low = 110, bar i high = 105 → bearish FVG
            const bars = makeBars([
                { high: 120, low: 110, close: 115 }, // i-2: low=110
                { high: 115, low: 107, close: 111 }, // i-1
                { high: 105, low: 95, close: 100 }, // i: high=105 < 110
            ]);
            const result = calculateSmc(bars, 1);
            expect(result.fairValueGaps.length).toBe(1);
            expect(result.fairValueGaps[0].type).toBe('bearish');
            expect(result.fairValueGaps[0].high).toBe(110);
            expect(result.fairValueGaps[0].low).toBe(105);
        });

        it('FVG가 없는 경우 빈 배열을 반환한다', () => {
            const bars = makeUniformBars(10, 100);
            const result = calculateSmc(bars, 3);
            expect(result.fairValueGaps).toEqual([]);
        });

        it('3개 미만의 bars에서 FVG를 감지하지 않는다', () => {
            const bars = makeBars([
                { high: 100, low: 90, close: 95 },
                { high: 103, low: 93, close: 98 },
            ]);
            const result = calculateSmc(bars, 1);
            expect(result.fairValueGaps).toEqual([]);
        });

        it('상승 FVG가 이후 캔들에 의해 침범되면 isMitigated가 true다', () => {
            const bars = makeBars([
                { high: 100, low: 90, close: 95 }, // anchor: high=100
                { high: 103, low: 93, close: 98 },
                { high: 112, low: 105, close: 110 }, // bullish FVG: zone [100, 105]
                { high: 108, low: 104, close: 106 }, // low=104 <= fvg.high=105 → mitigated
            ]);
            const result = calculateSmc(bars, 1);
            const fvg = result.fairValueGaps.find(f => f.type === 'bullish');
            expect(fvg?.isMitigated).toBe(true);
        });

        it('상승 FVG가 이후에도 유효하면 isMitigated가 false다', () => {
            const bars = makeBars([
                { high: 100, low: 90, close: 95 }, // anchor: high=100
                { high: 103, low: 93, close: 98 },
                { high: 112, low: 105, close: 110 }, // bullish FVG
                { high: 115, low: 106, close: 113 }, // low=106 > fvg.high=105 → not mitigated
            ]);
            const result = calculateSmc(bars, 1);
            const fvg = result.fairValueGaps.find(f => f.type === 'bullish');
            expect(fvg?.isMitigated).toBe(false);
        });
    });

    describe('구조 이탈 감지 (BOS / CHoCH)', () => {
        it('스윙 고점을 상향 돌파하면 불리시 구조 이탈을 기록한다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            const bullishBreaks = result.structureBreaks.filter(
                b => b.type === 'bullish'
            );
            expect(bullishBreaks.length).toBeGreaterThan(0);
        });

        it('스윙 저점을 하향 돌파하면 베어리시 구조 이탈을 기록한다', () => {
            const bars = makeBearishBreakSequence();
            const result = calculateSmc(bars, 3);
            const bearishBreaks = result.structureBreaks.filter(
                b => b.type === 'bearish'
            );
            expect(bearishBreaks.length).toBeGreaterThan(0);
        });

        it('breakType은 bos 또는 choch 중 하나다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.structureBreaks.forEach(sb => {
                expect(['bos', 'choch']).toContain(sb.breakType);
            });
        });

        it('스윙 포인트가 없으면 구조 이탈을 감지하지 않는다', () => {
            const bars = makeUniformBars(3, 100);
            const result = calculateSmc(bars);
            expect(result.structureBreaks).toEqual([]);
        });

        it('구조 이탈의 index 필드는 bars 배열의 유효한 인덱스다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.structureBreaks.forEach(sb => {
                expect(sb.index).toBeGreaterThanOrEqual(0);
                expect(sb.index).toBeLessThan(bars.length);
            });
        });
    });

    describe('Order Block 감지', () => {
        it('불리시 구조 이탈 후 Order Block을 감지한다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            // makeBullishBreakSequence guarantees structure breaks and opposing candles
            expect(result.structureBreaks.length).toBeGreaterThan(0);
            expect(result.orderBlocks.length).toBeGreaterThan(0);
        });

        it('Order Block의 high는 low보다 크거나 같다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.orderBlocks.forEach(ob => {
                expect(ob.high).toBeGreaterThanOrEqual(ob.low);
            });
        });

        it('Order Block의 type은 bullish 또는 bearish다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.orderBlocks.forEach(ob => {
                expect(['bullish', 'bearish']).toContain(ob.type);
            });
        });

        it('Order Block의 startIndex는 유효한 bars 인덱스다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.orderBlocks.forEach(ob => {
                expect(ob.startIndex).toBeGreaterThanOrEqual(0);
                expect(ob.startIndex).toBeLessThan(bars.length);
            });
        });

        it('isMitigated는 boolean 값이다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            result.orderBlocks.forEach(ob => {
                expect(typeof ob.isMitigated).toBe('boolean');
            });
        });
    });

    describe('Equal High / Low 감지', () => {
        it('equalHighs와 equalLows는 배열로 반환한다', () => {
            const bars = makeUniformBars(ENOUGH_BARS, 100);
            const result = calculateSmc(bars);
            expect(Array.isArray(result.equalHighs)).toBe(true);
            expect(Array.isArray(result.equalLows)).toBe(true);
        });

        it('Equal Level의 firstIndex는 secondIndex보다 작다', () => {
            const bars = makeUniformBars(ENOUGH_BARS, 100);
            const result = calculateSmc(bars);
            [...result.equalHighs, ...result.equalLows].forEach(el => {
                expect(el.firstIndex).toBeLessThan(el.secondIndex);
            });
        });

        it('Equal Level의 type은 high 또는 low다', () => {
            const bars = makeUniformBars(ENOUGH_BARS, 100);
            const result = calculateSmc(bars);
            result.equalHighs.forEach(el => expect(el.type).toBe('high'));
            result.equalLows.forEach(el => expect(el.type).toBe('low'));
        });

        it('Equal Level의 price는 두 스윙 가격의 평균이다', () => {
            const bars = makeUniformBars(ENOUGH_BARS, 100);
            const result = calculateSmc(bars);
            // uniform bars (close=100): swing high price=105, swing low price=95
            // equal high average = (105+105)/2 = 105, equal low average = (95+95)/2 = 95
            result.equalHighs.forEach(el => {
                expect(el.price).toBe(105);
            });
            result.equalLows.forEach(el => {
                expect(el.price).toBe(95);
            });
        });
    });

    describe('Premium / Discount / Equilibrium 존', () => {
        it('스윙 포인트가 있으면 세 존을 모두 반환한다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            // makeBullishBreakSequence guarantees swing highs and lows
            expect(result.swingHighs.length).toBeGreaterThan(0);
            expect(result.swingLows.length).toBeGreaterThan(0);
            expect(result.premiumZone).not.toBeNull();
            expect(result.discountZone).not.toBeNull();
            expect(result.equilibriumZone).not.toBeNull();
        });

        it('스윙 포인트가 없으면 세 존은 모두 null이다', () => {
            const bars = makeUniformBars(3, 100);
            const result = calculateSmc(bars);
            expect(result.premiumZone).toBeNull();
            expect(result.discountZone).toBeNull();
            expect(result.equilibriumZone).toBeNull();
        });

        it('premium 존의 high는 discount 존의 low보다 크다', () => {
            const result = calculateSmc(makeBullishBreakSequence(), 3);
            // makeBullishBreakSequence guarantees zones are non-null
            expect(result.premiumZone!.high).toBeGreaterThan(
                result.discountZone!.low
            );
        });

        it('존 type 필드가 올바르다', () => {
            const result = calculateSmc(makeBullishBreakSequence(), 3);
            // makeBullishBreakSequence guarantees all three zones are present
            expect(result.premiumZone!.type).toBe('premium');
            expect(result.discountZone!.type).toBe('discount');
            expect(result.equilibriumZone!.type).toBe('equilibrium');
        });

        it('bullish 구조 이탈 이후 range 상단은 이탈 가격 이상이다', () => {
            const bars = makeBullishBreakSequence();
            const result = calculateSmc(bars, 3);
            const bullishBreaks = result.structureBreaks.filter(
                b => b.type === 'bullish'
            );
            expect(bullishBreaks.length).toBeGreaterThan(0);
            const lastBreak = bullishBreaks[bullishBreaks.length - 1];
            // structure-break-aware range 에서는 이탈 가격이 range 상단 앵커로 포함
            expect(result.premiumZone!.high).toBeGreaterThanOrEqual(
                lastBreak.price
            );
        });

        it('bearish 구조 이탈 이후 range 하단은 이탈 가격 이하이다', () => {
            const bars = makeBearishBreakSequence();
            const result = calculateSmc(bars, 3);
            const bearishBreaks = result.structureBreaks.filter(
                b => b.type === 'bearish'
            );
            expect(bearishBreaks.length).toBeGreaterThan(0);
            const lastBreak = bearishBreaks[bearishBreaks.length - 1];
            expect(result.discountZone!.low).toBeLessThanOrEqual(
                lastBreak.price
            );
        });
    });

    describe('반환 타입 구조', () => {
        it('모든 필수 필드가 포함된 SMCResult 객체를 반환한다', () => {
            const bars = makeUniformBars(ENOUGH_BARS);
            const result: SMCResult = calculateSmc(bars);

            expect(result).toHaveProperty('swingHighs');
            expect(result).toHaveProperty('swingLows');
            expect(result).toHaveProperty('orderBlocks');
            expect(result).toHaveProperty('fairValueGaps');
            expect(result).toHaveProperty('equalHighs');
            expect(result).toHaveProperty('equalLows');
            expect(result).toHaveProperty('premiumZone');
            expect(result).toHaveProperty('discountZone');
            expect(result).toHaveProperty('equilibriumZone');
            expect(result).toHaveProperty('structureBreaks');
        });

        it('기본 swingPeriod는 SMC_SWING_PERIOD와 동일하다', () => {
            const bars = makeUniformBars(ENOUGH_BARS);
            expect(calculateSmc(bars)).toEqual(
                calculateSmc(bars, SMC_SWING_PERIOD)
            );
        });
    });
});
