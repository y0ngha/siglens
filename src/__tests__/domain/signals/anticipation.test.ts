import {
    findPivotLows,
    findPivotHighs,
    computeBbWidth,
    computePctB,
    computeEma20Slope,
    percentileRank,
    detectRsiBullishDivergence,
    detectRsiBearishDivergence,
    detectMacdHistogramBullishConvergence,
    detectMacdHistogramBearishConvergence,
    detectBollingerSqueezeBullish,
    detectBollingerSqueezeBearish,
} from '@/domain/signals/anticipation';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import type {
    Bar,
    BollingerResult,
    IndicatorResult,
    MACDResult,
} from '@/domain/types';

function barsFromOHLC(
    data: Array<{ open: number; high: number; low: number; close: number }>
): Bar[] {
    return data.map((d, i) => ({
        time: 1700000000 + i * 86400,
        volume: 1000,
        ...d,
    }));
}

function withRsiAndBars(rsi: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, rsi };
}

function withMacd(points: MACDResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, macd: points };
}

describe('findPivotLows', () => {
    describe('창 내에 명확한 저점이 있을 때', () => {
        it('좌우 2봉보다 엄격히 낮은 지점 인덱스를 반환한다', () => {
            const lows = [100, 98, 95, 92, 90, 92, 95, 97, 99];
            expect(findPivotLows(lows, 2)).toEqual([4]);
        });
    });
    describe('좌우 2봉 중 타이가 있을 때', () => {
        it('해당 인덱스를 제외한다', () => {
            const lows = [100, 98, 90, 92, 90, 92, 95];
            expect(findPivotLows(lows, 2)).toEqual([]);
        });
    });
    describe('경계 조건', () => {
        it('window보다 작은 인덱스는 반환하지 않는다', () => {
            const lows = [90, 95, 100, 95, 90];
            expect(findPivotLows(lows, 2)).toEqual([]);
        });
        it('빈 배열에 대해 빈 배열을 반환한다', () => {
            expect(findPivotLows([], 2)).toEqual([]);
        });
    });
});

describe('findPivotHighs', () => {
    describe('창 내에 명확한 고점이 있을 때', () => {
        it('인덱스를 반환한다', () => {
            const highs = [100, 102, 105, 108, 110, 108, 105, 103, 101];
            expect(findPivotHighs(highs, 2)).toEqual([4]);
        });
    });
    describe('좌우에 타이가 있을 때', () => {
        it('해당 인덱스를 제외한다', () => {
            const highs = [100, 102, 110, 108, 110, 108, 105];
            expect(findPivotHighs(highs, 2)).toEqual([]);
        });
    });
    describe('경계 조건', () => {
        it('빈 배열에 대해 빈 배열을 반환한다', () => {
            expect(findPivotHighs([], 2)).toEqual([]);
        });
    });
});

describe('computeBbWidth', () => {
    it('(upper - lower) / middle 을 반환한다', () => {
        const bb: BollingerResult = { upper: 110, middle: 100, lower: 90 };
        expect(computeBbWidth(bb)).toBeCloseTo(0.2);
    });
    it('middle이 0일 때 null을 반환한다', () => {
        const bb: BollingerResult = { upper: 1, middle: 0, lower: -1 };
        expect(computeBbWidth(bb)).toBeNull();
    });
    describe('nullable 필드 처리', () => {
        it('upper가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: null, middle: 100, lower: 90 };
            expect(computeBbWidth(bb)).toBeNull();
        });
        it('middle이 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: null, lower: 90 };
            expect(computeBbWidth(bb)).toBeNull();
        });
        it('lower가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: 100, lower: null };
            expect(computeBbWidth(bb)).toBeNull();
        });
    });
});

describe('computePctB', () => {
    it('(close - lower) / (upper - lower) 를 반환한다', () => {
        const bb: BollingerResult = { upper: 110, middle: 100, lower: 90 };
        expect(computePctB(105, bb)).toBeCloseTo(0.75);
    });
    it('upper == lower 일 때 null을 반환한다', () => {
        const bb: BollingerResult = { upper: 100, middle: 100, lower: 100 };
        expect(computePctB(100, bb)).toBeNull();
    });
    describe('nullable 필드 처리', () => {
        it('upper가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: null, middle: 100, lower: 90 };
            expect(computePctB(100, bb)).toBeNull();
        });
        it('lower가 null이면 null을 반환한다', () => {
            const bb: BollingerResult = { upper: 110, middle: 100, lower: null };
            expect(computePctB(100, bb)).toBeNull();
        });
    });
});

describe('computeEma20Slope', () => {
    describe('정상 입력', () => {
        it('(last - prev) / prev 를 반환한다', () => {
            const ema = Array.from({ length: 21 }, (_, i) => 100 + i);
            expect(computeEma20Slope(ema, 20)).toBeCloseTo(0.2);
        });
    });
    describe('데이터 부족 시', () => {
        it('null을 반환한다', () => {
            expect(computeEma20Slope([100, 101], 20)).toBeNull();
        });
    });
    describe('prev가 0일 때', () => {
        it('null을 반환한다', () => {
            const ema = [0, ...Array(20).fill(1)];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
    describe('last가 null일 때', () => {
        it('null을 반환한다', () => {
            const ema: (number | null)[] = [...Array(20).fill(1), null];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
    describe('prev가 null일 때', () => {
        it('null을 반환한다', () => {
            const ema: (number | null)[] = [null, ...Array(20).fill(1)];
            expect(computeEma20Slope(ema, 20)).toBeNull();
        });
    });
});

describe('percentileRank', () => {
    it('값이 배열 내에서 차지하는 백분위를 [0,1] 로 반환한다', () => {
        const xs = [1, 2, 3, 4, 5];
        expect(percentileRank(1, xs)).toBeCloseTo(0.0);
        expect(percentileRank(5, xs)).toBeCloseTo(1.0);
        expect(percentileRank(3, xs)).toBeCloseTo(0.5);
    });
    it('배열이 비어 있으면 null을 반환한다', () => {
        expect(percentileRank(1, [])).toBeNull();
    });
    describe('단일 원소 배열', () => {
        it('동일 값이면 0.5를 반환한다', () => {
            expect(percentileRank(5, [5])).toBeCloseTo(0.5);
        });
        it('값이 더 크면 1을 반환한다', () => {
            expect(percentileRank(10, [5])).toBe(1);
        });
        it('값이 더 작으면 0을 반환한다', () => {
            expect(percentileRank(1, [5])).toBe(0);
        });
    });
    describe('배열에 없는 값', () => {
        it('배열 내 상대 위치에 해당하는 비율을 반환한다', () => {
            expect(percentileRank(2.5, [1, 2, 3, 4, 5])).toBeCloseTo(0.4);
        });
    });
});

describe('detectRsiBullishDivergence', () => {
    describe('가격은 더 낮은 저점이고 RSI는 더 높은 저점일 때', () => {
        it('Signal을 반환한다', () => {
            // Flat baseline (100) ensures only indices 5 and 17 are pivot lows
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 90 : i === 17 ? 85 : 100;
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 25;
                if (i === 17) return 35;
                return 50;
            });
            const result = detectRsiBullishDivergence(
                barsFromOHLC(ohlc),
                withRsiAndBars(rsi)
            );
            expect(result?.type).toBe('rsi_bullish_divergence');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('expected');
        });
    });

    describe('Hidden divergence (price higher low + rsi lower low) 일 때', () => {
        it('null을 반환한다 (regular만 감지)', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 85 : i === 17 ? 90 : 100;
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 35;
                if (i === 17) return 25;
                return 50;
            });
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });

    describe('둘째 피벗이 최근 5봉 이전일 때', () => {
        it('null을 반환한다', () => {
            // Pivots at 5 and 10; lastIdx=19, so 19-10=9 > 5 (not fresh)
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 90 : i === 10 ? 85 : 100;
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 25;
                if (i === 10) return 35;
                return 50;
            });
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });

    describe('창 내 피벗이 2개 미만일 때', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, () => ({
                open: 100,
                high: 100,
                low: 100,
                close: 100,
            }));
            const rsi = Array(20).fill(50);
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });
});

describe('detectRsiBullishDivergence — 추가 엣지케이스', () => {
    describe('bars 길이가 lookback보다 작을 때', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 10 }, () => ({
                open: 100,
                high: 100,
                low: 100,
                close: 100,
            }));
            const rsi = Array(10).fill(50);
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });

    describe('피벗 위치의 RSI 값이 null일 때', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 90 : i === 17 ? 85 : 100;
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi: (number | null)[] = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return null; // first pivot has null RSI
                if (i === 17) return 35;
                return 50;
            });
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });

    describe('가격이 더 낮지만 RSI도 더 낮을 때 (regular 조건 미충족)', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const low = i === 5 ? 90 : i === 17 ? 85 : 100;
                return { open: low + 1, high: low + 2, low, close: low + 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 30;
                if (i === 17) return 25; // rsi2 <= rsi1
                return 50;
            });
            expect(
                detectRsiBullishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });
});

describe('detectRsiBearishDivergence', () => {
    describe('가격은 더 높은 고점이고 RSI는 더 낮은 고점일 때', () => {
        it('Signal을 반환한다', () => {
            // Flat baseline avoids incidental pivots; only 5 and 17 are pivots
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const high = i === 5 ? 105 : i === 17 ? 110 : 100;
                return { open: high - 1, high, low: high - 2, close: high - 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 75;
                if (i === 17) return 65;
                return 50;
            });
            const result = detectRsiBearishDivergence(
                barsFromOHLC(ohlc),
                withRsiAndBars(rsi)
            );
            expect(result?.type).toBe('rsi_bearish_divergence');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('expected');
        });
    });

    describe('가격이 더 낮은 고점일 때 (regular 조건 미충족)', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const high = i === 5 ? 110 : i === 17 ? 105 : 100;
                return { open: high - 1, high, low: high - 2, close: high - 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 75;
                if (i === 17) return 65;
                return 50;
            });
            expect(
                detectRsiBearishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });

    describe('가격이 더 높은 고점이지만 RSI도 더 높을 때', () => {
        it('null을 반환한다', () => {
            const ohlc = Array.from({ length: 20 }, (_, i) => {
                const high = i === 5 ? 105 : i === 17 ? 110 : 100;
                return { open: high - 1, high, low: high - 2, close: high - 1 };
            });
            const rsi = Array.from({ length: 20 }, (_, i) => {
                if (i === 5) return 65;
                if (i === 17) return 75; // rsi2 >= rsi1
                return 50;
            });
            expect(
                detectRsiBearishDivergence(
                    barsFromOHLC(ohlc),
                    withRsiAndBars(rsi)
                )
            ).toBeNull();
        });
    });
});

describe('detectMacdHistogramBullishConvergence', () => {
    describe('최근 5봉이 모두 음수이고 절대값이 단조 감소할 때', () => {
        it('Signal을 반환한다', () => {
            const hist = [-5, -4, -3, -2, -1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            const result = detectMacdHistogramBullishConvergence(
                [],
                withMacd(points)
            );
            expect(result?.type).toBe('macd_histogram_bullish_convergence');
        });
    });

    describe('0이 포함되면', () => {
        it('null을 반환한다', () => {
            const hist = [-5, -4, -3, -2, 0];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBullishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });

    describe('단조가 깨지면', () => {
        it('null을 반환한다', () => {
            const hist = [-5, -4, -5, -2, -1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBullishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });

    describe('타이가 있으면', () => {
        it('null을 반환한다 (엄격 단조)', () => {
            const hist = [-5, -4, -4, -2, -1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBullishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });

    describe('macd 길이가 5봉 미만일 때', () => {
        it('null을 반환한다', () => {
            const hist = [-4, -3, -2, -1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBullishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });
});

describe('detectMacdHistogramBearishConvergence', () => {
    describe('최근 5봉이 모두 양수이고 값이 단조 감소할 때', () => {
        it('Signal을 반환한다', () => {
            const hist = [5, 4, 3, 2, 1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            const result = detectMacdHistogramBearishConvergence(
                [],
                withMacd(points)
            );
            expect(result?.type).toBe('macd_histogram_bearish_convergence');
        });
    });

    describe('0이 포함되면', () => {
        it('null을 반환한다', () => {
            const hist = [5, 4, 3, 2, 0];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBearishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });

    describe('단조가 깨지면', () => {
        it('null을 반환한다', () => {
            const hist = [5, 4, 5, 2, 1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBearishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });

    describe('macd 길이가 5봉 미만일 때', () => {
        it('null을 반환한다', () => {
            const hist = [4, 3, 2, 1];
            const points: MACDResult[] = hist.map((h) => ({
                macd: 0,
                signal: 0,
                histogram: h,
            }));
            expect(
                detectMacdHistogramBearishConvergence([], withMacd(points))
            ).toBeNull();
        });
    });
});

function squeezeFixture(opts: {
    wideCount?: number;
    pctB: number;
    emaSlope: 'up' | 'down';
}): { bars: Bar[]; indicators: IndicatorResult } {
    const wideCount = opts.wideCount ?? 119;
    // First `wideCount` wide bands (width ~0.2), final bar narrow (width ~0.02)
    const bb: BollingerResult[] = [
        ...Array(wideCount)
            .fill(null)
            .map(() => ({ upper: 110, middle: 100, lower: 90 })),
        { upper: 101, middle: 100, lower: 99 },
    ];
    // close that produces the requested %B
    const width =
        (bb[bb.length - 1].upper as number) -
        (bb[bb.length - 1].lower as number);
    const close = (bb[bb.length - 1].lower as number) + opts.pctB * width;
    const bars: Bar[] = bb.map((_, i) => ({
        time: 1 + i,
        open: close,
        high: close,
        low: close,
        close,
        volume: 100,
    }));
    const slopeDir = opts.emaSlope === 'up' ? 1 : -1;
    const ema20 = bb.map((_, i) => 100 + slopeDir * i * 0.5);
    return {
        bars,
        indicators: {
            ...EMPTY_INDICATOR_RESULT,
            bollinger: bb,
            ema: { 20: ema20 },
        },
    };
}

describe('detectBollingerSqueezeBullish', () => {
    describe('너비 하위 10% + %B ≥ 0.5 + 기울기 ≥ 0 일 때', () => {
        it('Signal을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            const result = detectBollingerSqueezeBullish(bars, indicators);
            expect(result?.type).toBe('bollinger_squeeze_bullish');
        });
    });

    describe('%B가 0.5 미만일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.3,
                emaSlope: 'up',
            });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });

    describe('EMA20 기울기가 음수일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'down',
            });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });

    describe('bb 데이터가 120봉 미만일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                wideCount: 50,
                pctB: 0.6,
                emaSlope: 'up',
            });
            expect(detectBollingerSqueezeBullish(bars, indicators)).toBeNull();
        });
    });
});

describe('detectBollingerSqueezeBearish', () => {
    describe('너비 하위 10% + %B < 0.5 + 기울기 ≤ 0 일 때', () => {
        it('Signal을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.4,
                emaSlope: 'down',
            });
            const result = detectBollingerSqueezeBearish(bars, indicators);
            expect(result?.type).toBe('bollinger_squeeze_bearish');
        });
    });

    describe('bb 데이터가 120봉 미만일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                wideCount: 50,
                pctB: 0.4,
                emaSlope: 'down',
            });
            expect(detectBollingerSqueezeBearish(bars, indicators)).toBeNull();
        });
    });

    describe('%B가 0.5 이상일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'down',
            });
            expect(detectBollingerSqueezeBearish(bars, indicators)).toBeNull();
        });
    });

    describe('EMA20 기울기가 양수일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.4,
                emaSlope: 'up',
            });
            expect(detectBollingerSqueezeBearish(bars, indicators)).toBeNull();
        });
    });
});

describe('detectBollingerSqueezeBullish — 추가 엣지케이스', () => {
    describe('bars.length !== bb.length 일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            // Drop the last bar to desync lengths
            const mismatchedBars = bars.slice(0, -1);
            expect(
                detectBollingerSqueezeBullish(mismatchedBars, indicators)
            ).toBeNull();
        });
    });

    describe('마지막 bb 밴드가 null 필드를 포함할 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            const bb = [...indicators.bollinger];
            bb[bb.length - 1] = { upper: null, middle: null, lower: null };
            expect(
                detectBollingerSqueezeBullish(bars, {
                    ...indicators,
                    bollinger: bb,
                })
            ).toBeNull();
        });
    });

    describe('중간 bb 밴드에 null 필드가 섞여 있을 때', () => {
        it('null인 width는 건너뛰고 나머지로 percentile을 계산한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            const bb = [...indicators.bollinger];
            // Insert a null-field band in the lookback window to exercise the `continue` path
            bb[0] = { upper: null, middle: null, lower: null };
            const result = detectBollingerSqueezeBullish(bars, {
                ...indicators,
                bollinger: bb,
            });
            expect(result?.type).toBe('bollinger_squeeze_bullish');
        });
    });

    describe('마지막 bb에서 upper == lower 일 때 (pctB null)', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            const bb = [...indicators.bollinger];
            // Keep width computable via middle but make pctB fail (upper == lower)
            bb[bb.length - 1] = { upper: 100, middle: 100, lower: 100 };
            expect(
                detectBollingerSqueezeBullish(bars, {
                    ...indicators,
                    bollinger: bb,
                })
            ).toBeNull();
        });
    });

    describe('indicators.ema[20] 이 undefined 일 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            expect(
                detectBollingerSqueezeBullish(bars, {
                    ...indicators,
                    ema: {},
                })
            ).toBeNull();
        });
    });

    describe('computeEma20Slope가 null을 반환할 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            // Short EMA array forces slope computation to fail
            expect(
                detectBollingerSqueezeBullish(bars, {
                    ...indicators,
                    ema: { 20: [100, 101] },
                })
            ).toBeNull();
        });
    });

    describe('마지막 밴드 너비가 하위 10%에 들지 않을 때', () => {
        it('null을 반환한다', () => {
            const { bars, indicators } = squeezeFixture({
                pctB: 0.6,
                emaSlope: 'up',
            });
            const bb = [...indicators.bollinger];
            // Last band is wider than all others, rank = 1 > SQUEEZE_PERCENTILE (0.1)
            bb[bb.length - 1] = { upper: 150, middle: 100, lower: 50 };
            expect(
                detectBollingerSqueezeBullish(bars, {
                    ...indicators,
                    bollinger: bb,
                })
            ).toBeNull();
        });
    });
});
