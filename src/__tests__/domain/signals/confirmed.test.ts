import {
    detectRsiOversold,
    detectRsiOverbought,
    detectGoldenCross,
    detectDeathCross,
    detectMacdBullishCross,
    detectMacdBearishCross,
    detectBollingerLowerBounce,
    detectBollingerUpperBreakout,
    detectSupertrendBullishFlip,
    detectIchimokuCloudBreakout,
    detectCciBullishCross,
    detectDmiBullishCross,
    detectCmfBullishFlip,
    detectMfiOversoldBounce,
    detectParabolicSarFlip,
    detectKeltnerUpperBreakout,
    detectSqueezeMomentumBullish,
    findThresholdCross,
} from '@/domain/signals/confirmed';
import { EMPTY_INDICATOR_RESULT } from '@/domain/indicators/constants';
import { calculateMA } from '@/domain/indicators/ma';
import type {
    Bar,
    BollingerResult,
    DMIResult,
    IchimokuResult,
    IndicatorResult,
    KeltnerChannelResult,
    MACDResult,
    ParabolicSARResult,
    SqueezeMomentumResult,
    SupertrendResult,
} from '@/domain/types';

function buildBars(n: number): Bar[] {
    return Array.from({ length: n }, (_, i) => ({
        time: 1700000000 + i * 86400,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
    }));
}

function withRsi(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, rsi: values };
}

function withSupertrend(values: SupertrendResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, supertrend: values };
}

function withIchimoku(values: IchimokuResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, ichimoku: values };
}

function withCci(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, cci: values };
}

function withDmi(values: DMIResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, dmi: values };
}

function withCmf(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, cmf: values };
}

function withMfi(values: (number | null)[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, mfi: values };
}

function withSar(values: ParabolicSARResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, parabolicSar: values };
}

function withKeltner(values: KeltnerChannelResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, keltnerChannel: values };
}

function withSqueezeMomentum(values: SqueezeMomentumResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, squeezeMomentum: values };
}

function sqz(momentum: number | null): SqueezeMomentumResult {
    return {
        momentum,
        sqzOn: null,
        sqzOff: null,
        noSqz: null,
        increasing: null,
    };
}

describe('detectRsiOversold', () => {
    describe('마지막 RSI가 30 미만일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 25]);
            const result = detectRsiOversold(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_oversold');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(19);
        });
    });

    describe('마지막 RSI가 30 이상일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 35]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=30일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 30]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });

    describe('RSI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(detectRsiOversold(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('마지막 RSI가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const indicators = withRsi([null, null, null, null, null]);
            expect(detectRsiOversold(bars, indicators)).toBeNull();
        });
    });
});

describe('detectRsiOverbought', () => {
    describe('마지막 RSI가 70 초과일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 75]);
            const result = detectRsiOverbought(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('rsi_overbought');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('마지막 RSI가 70 이하일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 65]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });

    describe('경계값 RSI=70일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(20);
            const indicators = withRsi([...Array(19).fill(50), 70]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });

    describe('RSI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(
                detectRsiOverbought(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('마지막 RSI가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const indicators = withRsi([null, null, null, null, null]);
            expect(detectRsiOverbought(bars, indicators)).toBeNull();
        });
    });
});

function buildBarsWithCloses(closes: number[]): Bar[] {
    return closes.map((c, i) => ({
        time: 1700000000 + i * 86400,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
    }));
}

describe('detectGoldenCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 상향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            // V-shape: 45봉 하락(100→77.5) 후 15봉 상승(77.5→105.5).
            // MA20이 MA50을 마지막 3봉 내에서 상향 교차하도록 설계.
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectGoldenCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('golden_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 4봉 이전에 발생했을 때', () => {
        it('null을 반환한다', () => {
            // 45봉 하락 + 20봉 상승 → 교차가 idx=59 부근에서 발생하고
            // len=65이므로 교차-to-last 거리가 5봉 → 최근 3봉 밖.
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 20 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 MA50에 부족할 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses(Array(30).fill(100));
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 51봉이어서 lookback 범위에 null MA 구간이 포함될 때', () => {
        it('null MA 봉은 건너뛰고 평탄 가격이라 교차가 없으므로 null을 반환한다', () => {
            // 51봉 flat: len=51, start=max(1, 51-3)=48. MA50은 idx=48에서 null이라
            // null 건너뛰기 분기(continue)가 실행됨.
            const bars = buildBarsWithCloses(Array(51).fill(100));
            expect(detectGoldenCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('indicators.ma[20]이 사전 계산되어 제공된 경우', () => {
        it('사전 계산된 MA20을 재사용하여 Signal을 반환한다', () => {
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 - i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 77.5 + i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            // 캐리어 역할: ma[20]이 EMPTY가 아니라 실제 계산된 배열이 주어진 경우
            // ?? 연산자의 왼쪽 피연산자가 선택되는 분기를 커버.
            const precomputedMa20 = calculateMA(bars, 20);
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                ma: { 20: precomputedMa20 },
            };
            const result = detectGoldenCross(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('golden_cross');
        });
    });
});

describe('detectDeathCross', () => {
    describe('최근 3봉 내 MA20이 MA50을 하향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            // Inverted V-shape: 45봉 상승(100→122.5) 후 15봉 하락(122.5→94.5).
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 + i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 122.5 - i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const result = detectDeathCross(bars, EMPTY_INDICATOR_RESULT);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('death_cross');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 발생하지 않았을 때', () => {
        it('null을 반환한다', () => {
            const closes = Array(80).fill(100);
            const bars = buildBarsWithCloses(closes);
            expect(detectDeathCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('bars가 MA50에 부족할 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses(Array(30).fill(100));
            expect(detectDeathCross(bars, EMPTY_INDICATOR_RESULT)).toBeNull();
        });
    });

    describe('indicators.ma[20]이 사전 계산되어 제공된 경우', () => {
        it('사전 계산된 MA20을 재사용하여 Signal을 반환한다', () => {
            const closes = [
                ...Array.from({ length: 45 }, (_, i) => 100 + i * 0.5),
                ...Array.from({ length: 15 }, (_, i) => 122.5 - i * 2),
            ];
            const bars = buildBarsWithCloses(closes);
            const precomputedMa20 = calculateMA(bars, 20);
            const indicators: IndicatorResult = {
                ...EMPTY_INDICATOR_RESULT,
                ma: { 20: precomputedMa20 },
            };
            const result = detectDeathCross(bars, indicators);
            expect(result).not.toBeNull();
            expect(result?.type).toBe('death_cross');
        });
    });
});

function withMacd(points: MACDResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, macd: points };
}

describe('detectMacdBullishCross', () => {
    describe('최근 3봉 내 MACD line이 signal line을 상향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            const points: MACDResult[] = [
                { macd: -1, signal: 0, histogram: -1 },
                { macd: -0.5, signal: 0, histogram: -0.5 },
                { macd: -0.2, signal: -0.1, histogram: -0.1 },
                { macd: 0.1, signal: -0.05, histogram: 0.15 }, // cross up
            ];
            const bars = buildBars(points.length);
            const result = detectMacdBullishCross(bars, withMacd(points));
            expect(result?.type).toBe('macd_bullish_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('교차가 4봉 이전이거나 없을 때', () => {
        it('null을 반환한다', () => {
            const points: MACDResult[] = [
                { macd: 1, signal: 0, histogram: 1 },
                { macd: 1.1, signal: 0.05, histogram: 1.05 },
                { macd: 1.2, signal: 0.1, histogram: 1.1 },
            ];
            const bars = buildBars(points.length);
            expect(detectMacdBullishCross(bars, withMacd(points))).toBeNull();
        });
    });

    describe('MACD 포인트가 2개 미만일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(1);
            expect(
                detectMacdBullishCross(
                    bars,
                    withMacd([{ macd: 0.1, signal: 0, histogram: 0.1 }])
                )
            ).toBeNull();
        });
    });

    describe('MACDResult 내부 필드가 null인 경우', () => {
        it('내부 null 필드 봉은 건너뛰고 교차를 탐지한다', () => {
            const points: MACDResult[] = [
                { macd: null, signal: null, histogram: null },
                { macd: -0.2, signal: -0.1, histogram: -0.1 },
                { macd: 0.1, signal: -0.05, histogram: 0.15 },
            ];
            const bars = buildBars(points.length);
            const result = detectMacdBullishCross(bars, withMacd(points));
            expect(result?.type).toBe('macd_bullish_cross');
        });
    });
});

describe('detectMacdBearishCross', () => {
    describe('최근 3봉 내 MACD line이 signal line을 하향 교차할 때', () => {
        it('Signal을 반환한다', () => {
            const points: MACDResult[] = [
                { macd: 1, signal: 0, histogram: 1 },
                { macd: 0.5, signal: 0.2, histogram: 0.3 },
                { macd: 0.1, signal: 0.15, histogram: -0.05 }, // cross down
            ];
            const bars = buildBars(points.length);
            const result = detectMacdBearishCross(bars, withMacd(points));
            expect(result?.type).toBe('macd_bearish_cross');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
        });
    });

    describe('하향 교차가 발생하지 않을 때', () => {
        it('null을 반환한다', () => {
            const points: MACDResult[] = [
                { macd: 1, signal: 0, histogram: 1 },
                { macd: 1.1, signal: 0.05, histogram: 1.05 },
                { macd: 1.2, signal: 0.1, histogram: 1.1 },
            ];
            const bars = buildBars(points.length);
            expect(detectMacdBearishCross(bars, withMacd(points))).toBeNull();
        });
    });
});

function withBollinger(points: BollingerResult[]): IndicatorResult {
    return { ...EMPTY_INDICATOR_RESULT, bollinger: points };
}

describe('detectBollingerLowerBounce', () => {
    describe('전봉 low가 lower 이하이고 현봉 close가 전봉 close보다 높을 때', () => {
        it('Signal을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 95,
                    high: 96,
                    low: 89,
                    close: 92,
                    volume: 100,
                },
                {
                    time: 2,
                    open: 92,
                    high: 98,
                    low: 92,
                    close: 97,
                    volume: 100,
                },
            ];
            const result = detectBollingerLowerBounce(
                bars,
                withBollinger(points)
            );
            expect(result?.type).toBe('bollinger_lower_bounce');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(1);
        });
    });

    describe('전봉 low가 lower보다 크면', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 95,
                    high: 96,
                    low: 93,
                    close: 94,
                    volume: 100,
                },
                {
                    time: 2,
                    open: 94,
                    high: 98,
                    low: 94,
                    close: 97,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerLowerBounce(bars, withBollinger(points))
            ).toBeNull();
        });
    });

    describe('현봉 close가 전봉 close 이하이면', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 95,
                    high: 96,
                    low: 89,
                    close: 95,
                    volume: 100,
                },
                {
                    time: 2,
                    open: 95,
                    high: 96,
                    low: 90,
                    close: 95,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerLowerBounce(bars, withBollinger(points))
            ).toBeNull();
        });
    });

    describe('bars 또는 bollinger 데이터가 부족할 때', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 95,
                    high: 96,
                    low: 89,
                    close: 92,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerLowerBounce(bars, withBollinger(points))
            ).toBeNull();
        });
    });

    describe('전봉 bollinger lower가 null일 때', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: null, middle: null, lower: null },
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 95,
                    high: 96,
                    low: 89,
                    close: 92,
                    volume: 100,
                },
                {
                    time: 2,
                    open: 92,
                    high: 98,
                    low: 92,
                    close: 97,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerLowerBounce(bars, withBollinger(points))
            ).toBeNull();
        });
    });
});

describe('detectBollingerUpperBreakout', () => {
    describe('현봉 close가 upper보다 클 때', () => {
        it('Signal을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 105,
                    high: 115,
                    low: 105,
                    close: 112,
                    volume: 100,
                },
            ];
            const result = detectBollingerUpperBreakout(
                bars,
                withBollinger(points)
            );
            expect(result?.type).toBe('bollinger_upper_breakout');
            expect(result?.direction).toBe('bearish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(0);
        });
    });

    describe('현봉 close가 upper 이하일 때', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: 110, middle: 100, lower: 90 },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 105,
                    high: 110,
                    low: 105,
                    close: 110,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerUpperBreakout(bars, withBollinger(points))
            ).toBeNull();
        });
    });

    describe('bars 또는 bollinger 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectBollingerUpperBreakout([], EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('현봉 bollinger upper가 null일 때', () => {
        it('null을 반환한다', () => {
            const points: BollingerResult[] = [
                { upper: null, middle: null, lower: null },
            ];
            const bars: Bar[] = [
                {
                    time: 1,
                    open: 105,
                    high: 115,
                    low: 105,
                    close: 112,
                    volume: 100,
                },
            ];
            expect(
                detectBollingerUpperBreakout(bars, withBollinger(points))
            ).toBeNull();
        });
    });
});

// ─── detectSupertrendBullishFlip ──────────────────────────────────────────────

describe('detectSupertrendBullishFlip', () => {
    describe('최근 3 bar 내 down→up 전환이 있을 때', () => {
        it('Signal을 전환 bar 인덱스로 반환한다', () => {
            const bars = buildBars(10);
            const st: SupertrendResult[] = [
                ...Array(7).fill({ supertrend: 100, trend: 'down' as const }),
                { supertrend: 100, trend: 'up' as const },
                { supertrend: 100, trend: 'up' as const },
                { supertrend: 100, trend: 'up' as const },
            ];
            const result = detectSupertrendBullishFlip(
                bars,
                withSupertrend(st)
            );
            expect(result).not.toBeNull();
            expect(result?.type).toBe('supertrend_bullish_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 전환이 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const st: SupertrendResult[] = [
                ...Array(3).fill({ supertrend: 100, trend: 'down' as const }),
                ...Array(7).fill({ supertrend: 100, trend: 'up' as const }),
            ];
            // 전환이 index 3에서 일어났으나 CROSS_LOOKBACK_BARS=3보다 오래됨
            expect(
                detectSupertrendBullishFlip(bars, withSupertrend(st))
            ).toBeNull();
        });
    });

    describe('supertrend 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            expect(
                detectSupertrendBullishFlip(bars, EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('직전 trend가 null일 때', () => {
        it('null을 반환한다 (전환 불명확)', () => {
            const bars = buildBars(5);
            const st: SupertrendResult[] = [
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: null, trend: null },
                { supertrend: 100, trend: 'up' as const },
            ];
            expect(
                detectSupertrendBullishFlip(bars, withSupertrend(st))
            ).toBeNull();
        });
    });
});

// ─── detectIchimokuCloudBreakout ──────────────────────────────────────────────

describe('detectIchimokuCloudBreakout', () => {
    const nullCloud: IchimokuResult = {
        tenkan: null,
        kijun: null,
        senkouA: null,
        senkouB: null,
        chikou: null,
    };

    describe('직전은 구름 아래, 최신 bar가 처음 돌파할 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBarsWithCloses([95, 96, 97, 105]);
            const ichimoku: IchimokuResult[] = [
                nullCloud,
                nullCloud,
                { ...nullCloud, senkouA: 100, senkouB: 99 }, // prev kumoUpper=100, prev.close=97 ≤ 100 ✓
                { ...nullCloud, senkouA: 102, senkouB: 100 }, // cur kumoUpper=102, cur.close=105 > 102 ✓
            ];
            const result = detectIchimokuCloudBreakout(
                bars,
                withIchimoku(ichimoku)
            );
            expect(result?.type).toBe('ichimoku_cloud_breakout');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(3);
        });
    });

    describe('직전 bar가 이미 구름 위에 있을 때', () => {
        it('null을 반환한다 (오탐지 방지)', () => {
            const bars = buildBarsWithCloses([95, 96, 100, 105]);
            const ichimoku: IchimokuResult[] = [
                nullCloud,
                nullCloud,
                { ...nullCloud, senkouA: 98, senkouB: 99 }, // prev kumoUpper=99, prev.close=100 > 99 (already above)
                { ...nullCloud, senkouA: 102, senkouB: 100 },
            ];
            expect(
                detectIchimokuCloudBreakout(bars, withIchimoku(ichimoku))
            ).toBeNull();
        });
    });

    describe('구름 데이터가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses([95, 100]);
            const ichimoku: IchimokuResult[] = [nullCloud, nullCloud];
            expect(
                detectIchimokuCloudBreakout(bars, withIchimoku(ichimoku))
            ).toBeNull();
        });
    });

    describe('bars 길이가 2 미만일 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectIchimokuCloudBreakout(
                    buildBarsWithCloses([100]),
                    EMPTY_INDICATOR_RESULT
                )
            ).toBeNull();
        });
    });
});

// ─── detectCciBullishCross ────────────────────────────────────────────────────

describe('detectCciBullishCross', () => {
    describe('최근 3 bar 내 -100 상향 돌파가 있을 때', () => {
        it('Signal을 전환 bar로 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(7).fill(-120),
                -80, // -100 상향 돌파 (index 7)
                -70,
                -60,
            ];
            const result = detectCciBullishCross(bars, withCci(cci));
            expect(result?.type).toBe('cci_bullish_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 +100 상향 돌파가 있을 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(7).fill(80),
                120,
                130,
                140, // +100 상향 돌파 (index 7)
            ];
            const result = detectCciBullishCross(bars, withCci(cci));
            expect(result?.type).toBe('cci_bullish_cross');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 돌파가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const cci = [
                ...Array(3).fill(-120),
                ...Array(7).fill(-80), // 돌파는 index 3에서 발생했으나 lookback=3 초과
            ];
            expect(detectCciBullishCross(bars, withCci(cci))).toBeNull();
        });
    });

    describe('CCI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectCciBullishCross(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });

    describe('CCI 데이터가 1개뿐일 때', () => {
        it('null을 반환한다 (length < 2 가드)', () => {
            const bars = buildBars(5);
            expect(detectCciBullishCross(bars, withCci([50]))).toBeNull();
        });
    });
});

// ─── detectDmiBullishCross ────────────────────────────────────────────────────

describe('detectDmiBullishCross', () => {
    describe('+DI가 -DI 상향 돌파 + ADX ≥ 20일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = [
                ...Array(7).fill({ diPlus: 15, diMinus: 25, adx: 22 }),
                { diPlus: 28, diMinus: 20, adx: 25 },
                { diPlus: 30, diMinus: 18, adx: 28 },
                { diPlus: 32, diMinus: 16, adx: 30 },
            ];
            const result = detectDmiBullishCross(bars, withDmi(dmi));
            expect(result?.type).toBe('dmi_bullish_cross');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('+DI가 -DI 상향 돌파했으나 ADX < 20일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = [
                ...Array(7).fill({ diPlus: 15, diMinus: 25, adx: 15 }),
                { diPlus: 28, diMinus: 20, adx: 18 },
                { diPlus: 30, diMinus: 18, adx: 18 },
                { diPlus: 32, diMinus: 16, adx: 18 },
            ];
            expect(detectDmiBullishCross(bars, withDmi(dmi))).toBeNull();
        });
    });

    describe('cross가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const dmi: DMIResult[] = Array(10).fill({
                diPlus: 15,
                diMinus: 25,
                adx: 30,
            });
            expect(detectDmiBullishCross(bars, withDmi(dmi))).toBeNull();
        });
    });

    describe('DMI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectDmiBullishCross(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});

// ─── detectCmfBullishFlip ─────────────────────────────────────────────────────

describe('detectCmfBullishFlip', () => {
    describe('최근 3 bar 내 CMF가 0 상향 돌파할 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const cmf = [
                ...Array(7).fill(-0.1),
                0.05, // 0 상향 돌파 (index 7)
                0.1,
                0.15,
            ];
            const result = detectCmfBullishFlip(bars, withCmf(cmf));
            expect(result?.type).toBe('cmf_bullish_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('최근 3 bar 내 돌파가 없을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const cmf = [...Array(3).fill(-0.1), ...Array(7).fill(0.1)];
            expect(detectCmfBullishFlip(bars, withCmf(cmf))).toBeNull();
        });
    });

    describe('CMF 데이터가 1개뿐일 때', () => {
        it('null을 반환한다 (length < 2 가드)', () => {
            const bars = buildBars(5);
            expect(detectCmfBullishFlip(bars, withCmf([0.2]))).toBeNull();
        });
    });

    describe('CMF 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectCmfBullishFlip(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});

// ─── detectMfiOversoldBounce ──────────────────────────────────────────────────

describe('detectMfiOversoldBounce', () => {
    describe('직전 MFI < 20, 최신 MFI ≥ 20일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(15), 22];
            const result = detectMfiOversoldBounce(bars, withMfi(mfi));
            expect(result?.type).toBe('mfi_oversold_bounce');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(9);
        });
    });

    describe('직전 MFI가 이미 20 이상이었을 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(25), 30];
            expect(detectMfiOversoldBounce(bars, withMfi(mfi))).toBeNull();
        });
    });

    describe('최신 MFI가 여전히 20 미만일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const mfi = [...Array(9).fill(15), 18];
            expect(detectMfiOversoldBounce(bars, withMfi(mfi))).toBeNull();
        });
    });

    describe('MFI 데이터가 1개뿐일 때', () => {
        it('null을 반환한다 (length < 2 가드)', () => {
            const bars = buildBars(5);
            expect(detectMfiOversoldBounce(bars, withMfi([15]))).toBeNull();
        });
    });

    describe('MFI 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectMfiOversoldBounce(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});

// ─── detectParabolicSarFlip ───────────────────────────────────────────────────

describe('detectParabolicSarFlip', () => {
    describe('최근 3 bar 내 down→up 전환일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const sar: ParabolicSARResult[] = [
                ...Array(7).fill({ sar: 110, trend: 'down' as const }),
                { sar: 95, trend: 'up' as const },
                { sar: 93, trend: 'up' as const },
                { sar: 91, trend: 'up' as const },
            ];
            const result = detectParabolicSarFlip(bars, withSar(sar));
            expect(result?.type).toBe('parabolic_sar_flip');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('lookback 초과 범위 전환일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const sar: ParabolicSARResult[] = [
                ...Array(3).fill({ sar: 110, trend: 'down' as const }),
                ...Array(7).fill({ sar: 95, trend: 'up' as const }),
            ];
            expect(detectParabolicSarFlip(bars, withSar(sar))).toBeNull();
        });
    });

    describe('SAR 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectParabolicSarFlip(buildBars(5), EMPTY_INDICATOR_RESULT)
            ).toBeNull();
        });
    });
});

// ─── detectKeltnerUpperBreakout ───────────────────────────────────────────────

describe('detectKeltnerUpperBreakout', () => {
    describe('직전 close ≤ upper, 최신 close > upper일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBarsWithCloses([98, 105]);
            const keltner: KeltnerChannelResult[] = [
                { upper: 100, middle: 95, lower: 90 },
                { upper: 102, middle: 97, lower: 92 },
            ];
            const result = detectKeltnerUpperBreakout(
                bars,
                withKeltner(keltner)
            );
            expect(result?.type).toBe('keltner_upper_breakout');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(1);
        });
    });

    describe('직전 이미 upper 위였다면', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses([105, 110]);
            const keltner: KeltnerChannelResult[] = [
                { upper: 100, middle: 95, lower: 90 },
                { upper: 102, middle: 97, lower: 92 },
            ];
            expect(
                detectKeltnerUpperBreakout(bars, withKeltner(keltner))
            ).toBeNull();
        });
    });

    describe('upper가 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBarsWithCloses([98, 105]);
            const keltner: KeltnerChannelResult[] = [
                { upper: null, middle: null, lower: null },
                { upper: null, middle: null, lower: null },
            ];
            expect(
                detectKeltnerUpperBreakout(bars, withKeltner(keltner))
            ).toBeNull();
        });
    });

    describe('bars 길이가 2 미만일 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectKeltnerUpperBreakout(
                    buildBarsWithCloses([100]),
                    EMPTY_INDICATOR_RESULT
                )
            ).toBeNull();
        });
    });
});

// ─── detectSqueezeMomentumBullish ─────────────────────────────────────────────

describe('detectSqueezeMomentumBullish', () => {
    describe('최근 3 bar 내 histogram 0 상향 돌파일 때', () => {
        it('Signal을 반환한다', () => {
            const bars = buildBars(10);
            const values = [
                ...Array(7).fill(sqz(-0.5)),
                sqz(0.3),
                sqz(0.5),
                sqz(0.7),
            ];
            const result = detectSqueezeMomentumBullish(
                bars,
                withSqueezeMomentum(values)
            );
            expect(result?.type).toBe('squeeze_momentum_bullish');
            expect(result?.direction).toBe('bullish');
            expect(result?.phase).toBe('confirmed');
            expect(result?.detectedAt).toBe(7);
        });
    });

    describe('lookback 초과 범위일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(10);
            const values = [
                ...Array(3).fill(sqz(-0.5)),
                ...Array(7).fill(sqz(0.3)),
            ];
            expect(
                detectSqueezeMomentumBullish(bars, withSqueezeMomentum(values))
            ).toBeNull();
        });
    });

    describe('momentum이 null일 때', () => {
        it('null을 반환한다', () => {
            const bars = buildBars(5);
            const values = Array(5).fill(sqz(null));
            expect(
                detectSqueezeMomentumBullish(bars, withSqueezeMomentum(values))
            ).toBeNull();
        });
    });

    describe('Squeeze Momentum 데이터가 없을 때', () => {
        it('null을 반환한다', () => {
            expect(
                detectSqueezeMomentumBullish(
                    buildBars(5),
                    EMPTY_INDICATOR_RESULT
                )
            ).toBeNull();
        });
    });
});

// ─── findThresholdCross helper ────────────────────────────────────────────────

describe('findThresholdCross', () => {
    describe('direction=up', () => {
        it('값이 임계값을 상향 돌파한 인덱스를 반환한다', () => {
            const values = [-5, -3, -1, 2];
            expect(findThresholdCross(values, 0, 3, 'up')).toBe(3);
        });

        it('돌파가 없으면 null을 반환한다', () => {
            expect(findThresholdCross([1, 2, 3, 4], 10, 3, 'up')).toBeNull();
        });

        it('null 값은 건너뛴다', () => {
            const values = [null, -1, null, 2];
            expect(findThresholdCross(values, 0, 4, 'up')).toBeNull();
        });
    });

    describe('direction=down', () => {
        it('값이 임계값을 하향 돌파한 인덱스를 반환한다', () => {
            const values = [5, 3, 1, -2];
            expect(findThresholdCross(values, 0, 3, 'down')).toBe(3);
        });

        it('돌파가 없으면 null을 반환한다', () => {
            expect(findThresholdCross([5, 4, 3, 2], -10, 3, 'down')).toBeNull();
        });
    });

    describe('lookback 경계', () => {
        it('lookback 범위 밖의 cross는 무시한다', () => {
            const values = [-5, 2, 3, 4, 5];
            // cross happened at index 1 (-5 → 2), lookback=2 covers [3, 4]
            expect(findThresholdCross(values, 0, 2, 'up')).toBeNull();
        });
    });
});
