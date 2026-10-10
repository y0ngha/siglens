import { calculateIndicators } from '@y0ngha/siglens-core';
import {
    candle,
    concatBars,
    pathToBars,
    toCoreBars,
    type Waypoint,
} from '@/views/guide/demos/generators';
import {
    crossedDown,
    emaOf,
    firstAfter,
    marker,
    maOf,
    num,
    overlayLine,
    pane,
    windowed,
} from '@/views/guide/demos/indicators';
import {
    getTrendSeries,
    TREND_DIP_LOW,
} from '@/views/guide/demos/sharedSeries';
import type {
    DemoBar,
    DemoOverlay,
    GuideDemo,
} from '@/views/guide/demos/types';

/**
 * 전략·이론 데모. 이동평균·RSI·MACD 값은 core `calculateIndicators`의 실제 계산이고,
 * 가격 모양은 꼭짓점(`pathToBars`)에서 만든다.
 */

const wp = (pairs: readonly (readonly [number, number])[]): Waypoint[] =>
    pairs.map(([i, price]) => ({ i, price }));

const withVolume = (
    bars: readonly DemoBar[],
    factor: (index: number) => number
): DemoBar[] =>
    bars.map((bar, index) => ({
        ...bar,
        volume: Math.round(1_000_000 * factor(index)),
    }));

const firstIndex = (
    bars: readonly DemoBar[],
    from: number,
    test: (bar: DemoBar, i: number) => boolean
): number => {
    for (let i = from; i < bars.length; i++) if (test(bars[i], i)) return i;
    return -1;
};

const week52HighMomentum = (): GuideDemo => {
    const bars = pathToBars(
        wp([
            [0, 100],
            [15, 118],
            [25, 108],
            [45, 120],
            [56, 111],
            [70, 119],
            [78, 116],
            [96, 142],
        ]),
        { seed: 71, rangePct: 0.016, noisePct: 0.012 }
    );
    const result = calculateIndicators(toCoreBars(bars));
    const breakIdx = firstIndex(bars, 60, bar => bar.close > 120);
    return {
        bars,
        overlays: [
            {
                kind: 'level',
                price: 120,
                fromIndex: 45,
                label: '52-week high',
                role: 'resistance',
            },
            overlayLine(maOf(result, 20), 'MA20', 'a'),
            overlayLine(maOf(result, 60), 'MA60', 'b'),
            ...marker(breakIdx, 'New high', 'bull', 'below'),
        ],
    };
};

const breakout = (): GuideDemo => {
    const raw = pathToBars(
        wp([
            [0, 100],
            [6, 108],
            [12, 100.5],
            [18, 108],
            [24, 100.5],
            [30, 108],
            [36, 102],
            [42, 114],
            [46, 117],
            [54, 108.6],
            [70, 125],
        ]),
        { seed: 72, rangePct: 0.014, noisePct: 0.008 }
    );
    const breakIdx = firstIndex(raw, 37, bar => bar.close > 108.4);
    const retest = raw.findIndex((bar, i) => i > 46 && bar.low <= 109.5);
    const bars = withVolume(raw, index =>
        index === breakIdx
            ? 3.2
            : index === breakIdx + 1
              ? 1.8
              : 0.8 + ((index * 7) % 5) * 0.06
    );
    return {
        bars,
        overlays: [
            {
                kind: 'level',
                price: 108,
                fromIndex: 6,
                label: 'Breakout line',
                role: 'resistance',
            },
            ...marker(breakIdx, 'Breakout', 'bull', 'below'),
            ...marker(retest, 'Retest', 'neutral', 'below'),
        ],
        panes: [
            pane('Volume', {
                histogram: bars.map(b => b.volume ?? 0),
                histogramTones: bars.map(b =>
                    b.close >= b.open ? 'bull' : 'bear'
                ),
                height: 64,
            }),
        ],
    };
};

/**
 * 다이버전스 전략 데모의 두 저점. SIGLENS의 다이버전스 후보는 최근 20봉 안의 피벗 저점 둘이고
 * 두 번째가 마지막 5봉 안이어야 하므로, 71봉 시세의 끝에서 20봉 안(51~70)에 두 저점을 둔다.
 */
const DIVERGENCE_LOW_A = 54;
const DIVERGENCE_LOW_B = 66;

const divergence = (): GuideDemo => {
    const bars = pathToBars(
        wp([
            [0, 122],
            [16, 114],
            [34, 128],
            [46, 111],
            [DIVERGENCE_LOW_A, 100],
            [59, 107.5],
            [DIVERGENCE_LOW_B, 98.5],
            [70, 104],
        ]),
        { seed: 21, rangePct: 0.016, noisePct: 0.012 }
    );
    const rsi = calculateIndicators(toCoreBars(bars)).rsi;
    const a = num(rsi[DIVERGENCE_LOW_A]);
    const b = num(rsi[DIVERGENCE_LOW_B]);
    const link = bars.map((_, i) =>
        i < DIVERGENCE_LOW_A || i > DIVERGENCE_LOW_B
            ? null
            : a +
              ((b - a) * (i - DIVERGENCE_LOW_A)) /
                  (DIVERGENCE_LOW_B - DIVERGENCE_LOW_A)
    );
    return {
        bars,
        overlays: [
            {
                kind: 'line',
                from: {
                    i: DIVERGENCE_LOW_A,
                    price: bars[DIVERGENCE_LOW_A].low,
                },
                to: { i: DIVERGENCE_LOW_B, price: bars[DIVERGENCE_LOW_B].low },
                role: 'support',
                label: 'Lower low',
            },
            ...marker(DIVERGENCE_LOW_B, 'Bullish divergence', 'bull', 'below'),
        ],
        panes: [
            pane('RSI 14', {
                lines: [
                    { values: rsi, label: '', tone: 'a' },
                    { values: link, label: 'Higher low', tone: 'bull' },
                ],
                levels: [{ value: 70 }, { value: 30 }],
                range: [0, 100],
            }),
        ],
    };
};

const elliottWave = (): GuideDemo => {
    const points = wp([
        [0, 100],
        [10, 120],
        [16, 108],
        [34, 150],
        [42, 132],
        [54, 160],
        [62, 146],
        [68, 153],
        [78, 128],
    ]);
    const bars = pathToBars(points, {
        seed: 74,
        rangePct: 0.016,
        noisePct: 0.006,
    });
    const labelled: [number, string, 'above' | 'below'][] = [
        [10, '1', 'above'],
        [16, '2', 'below'],
        [34, '3', 'above'],
        [42, '4', 'below'],
        [54, '5', 'above'],
        [62, 'A', 'below'],
        [68, 'B', 'above'],
        [78, 'C', 'below'],
    ];
    return {
        bars,
        overlays: [
            {
                kind: 'level',
                price: 100,
                fromIndex: 0,
                label: 'Wave 1 start',
                role: 'support',
            },
            ...labelled.flatMap(([i, label, position]) =>
                marker(i, label, 'neutral', position)
            ),
        ],
    };
};

const fibonacci = (): GuideDemo => {
    const bars = pathToBars(
        wp([
            [0, 110],
            [10, 100],
            [40, 130],
            [56, 115.3],
            [76, 134],
        ]),
        {
            seed: 75,
            rangePct: 0.014,
            noisePct: 0.008,
        }
    );
    const level = (ratio: number) => 130 - 30 * ratio;
    const levels: DemoOverlay[] = [0.382, 0.5, 0.618].map(ratio => ({
        kind: 'level',
        price: level(ratio),
        fromIndex: 10,
        label: `${(ratio * 100).toFixed(1).replace('.0', '')}%`,
        role: 'neutral',
    }));
    return {
        bars,
        overlays: [
            ...levels,
            ...marker(10, 'Swing low', 'neutral', 'below'),
            ...marker(40, 'Swing high', 'neutral', 'above'),
            ...marker(56, 'Bounce', 'bull', 'below'),
        ],
    };
};

const gapAnalysis = (): GuideDemo => {
    const base = pathToBars(
        wp([
            [0, 103],
            [6, 106],
            [12, 100.5],
            [18, 106],
            [24, 101],
            [27, 104.5],
        ]),
        {
            seed: 76,
            rangePct: 0.014,
            noisePct: 0.006,
        }
    );
    const prevHigh = base[base.length - 1].high;
    const gapLow = prevHigh + 2.2;
    const after = pathToBars(
        wp([
            [0, gapLow + 3.4],
            [12, gapLow + 12],
        ]),
        { seed: 77, rangePct: 0.014, noisePct: 0.006 }
    );
    const gapBar = candle(gapLow + 0.4, gapLow + 4.2, gapLow, gapLow + 3.6);
    const bars = concatBars(base, [gapBar], after.slice(1));
    const gapIdx = base.length;
    return {
        bars,
        overlays: [
            {
                kind: 'zone',
                fromIndex: gapIdx - 1,
                toIndex: gapIdx,
                low: prevHigh,
                high: gapLow,
                label: 'Gap',
            },
            {
                kind: 'level',
                price: prevHigh,
                fromIndex: gapIdx - 1,
                label: 'Prior bar high',
                role: 'resistance',
            },
            ...marker(gapIdx, 'Gap up', 'bull', 'below'),
        ],
    };
};

const maCycle = windowed(110, c => {
    const m5 = maOf(c.r, 5);
    const m20 = maOf(c.r, 20);
    const m60 = maOf(c.r, 60);
    return {
        overlays: [
            overlayLine(c.s(m5), 'MA5', 'a'),
            overlayLine(c.s(m20), 'MA20', 'b'),
            overlayLine(c.s(m60), 'MA60', 'c'),
            ...marker(
                firstAfter(c, 5, crossedDown(m5, m20)),
                'MA5 < MA20',
                'bear',
                'below'
            ),
            ...marker(
                firstAfter(c, 5, crossedDown(m5, m60)),
                'MA5 < MA60',
                'bear',
                'above'
            ),
            ...marker(
                firstAfter(c, 5, crossedDown(m20, m60)),
                'MA20 < MA60',
                'bear',
                'below'
            ),
        ],
    };
});

const macdCycle = windowed(110, c => {
    const e9 = emaOf(c.r, 9);
    const e21 = emaOf(c.r, 21);
    const e60 = emaOf(c.r, 60);
    const diff = (
        a: readonly (number | null)[],
        b: readonly (number | null)[]
    ) =>
        a.map((v, i) =>
            v === null || b[i] === null ? null : v - (b[i] as number)
        );
    const upper = diff(e9, e21);
    const middle = diff(e9, e60);
    const lower = diff(e21, e60);
    const zeroCross = (values: readonly (number | null)[]) => (abs: number) =>
        num(values[abs]) < 0 && num(values[abs - 1]) >= 0;
    return {
        overlays: [
            overlayLine(c.s(e9), 'EMA9', 'a'),
            overlayLine(c.s(e21), 'EMA21', 'b'),
            overlayLine(c.s(e60), 'EMA60', 'c'),
            ...marker(firstAfter(c, 5, zeroCross(upper)), 'Upper < 0', 'bear'),
            ...marker(
                firstAfter(c, 5, zeroCross(middle)),
                'Middle < 0',
                'bear'
            ),
            ...marker(firstAfter(c, 5, zeroCross(lower)), 'Lower < 0', 'bear'),
        ],
        panes: [
            pane('MACD upper / middle / lower', {
                lines: [
                    { values: c.s(upper), label: 'Upper', tone: 'a' },
                    { values: c.s(middle), label: 'Middle', tone: 'b' },
                    { values: c.s(lower), label: 'Lower', tone: 'c' },
                ],
                levels: [{ value: 0 }],
                height: 96,
            }),
        ],
    };
});

const meanReversion = windowed(
    190,
    c => {
        const rel = TREND_DIP_LOW - c.start;
        const m5 = maOf(c.r, 5);
        const back = c.find(
            abs =>
                abs > TREND_DIP_LOW &&
                c.bars[abs - c.start].close > num(m5[abs])
        );
        const lows = c.bars.slice(rel - 13, rel + 1).map(b => b.low);
        return {
            overlays: [
                {
                    kind: 'series',
                    values: c.s(maOf(c.r, 200)),
                    label: 'MA200',
                    tone: 'c',
                    includeInDomain: true,
                },
                overlayLine(c.s(m5), 'MA5', 'a'),
                {
                    kind: 'level',
                    price: Math.min(...lows),
                    fromIndex: rel - 13,
                    label: '14-day low',
                    role: 'support',
                },
                ...marker(rel, 'Near range low', 'bull', 'below'),
                ...marker(back, 'Back above MA5', 'bull', 'above'),
            ],
        };
    },
    getTrendSeries,
    70
);

const multiTimeframe = windowed(
    150,
    c => {
        const rel = TREND_DIP_LOW - c.start;
        return {
            overlays: [
                overlayLine(c.s(maOf(c.r, 60)), 'MA60', 'b'),
                overlayLine(c.s(maOf(c.r, 120)), 'MA120', 'c'),
                {
                    kind: 'zone',
                    fromIndex: rel - 14,
                    toIndex: rel + 2,
                    low: c.bars[rel].low - 1,
                    high: c.bars[rel - 14].high,
                    label: 'Pullback',
                },
                ...marker(rel, 'Pullback low', 'neutral', 'below'),
            ],
        };
    },
    getTrendSeries,
    110
);

const pivotPoints = (): GuideDemo => {
    const bars = pathToBars(
        wp([
            [0, 100],
            [5, 108],
            [9, 98.5],
            [14, 104],
            [20, 106.5],
            [26, 101],
            [34, 109],
        ]),
        { seed: 79, rangePct: 0.014, noisePct: 0.006 }
    );
    const prior = bars.slice(0, 15);
    const high = Math.max(...prior.map(b => b.high));
    const low = Math.min(...prior.map(b => b.low));
    const close = prior[prior.length - 1].close;
    const pivot = (high + low + close) / 3;
    return {
        bars,
        highlight: { fromIndex: 0, toIndex: 14 },
        overlays: [
            {
                kind: 'level',
                price: 2 * pivot - low,
                fromIndex: 15,
                label: 'R1',
                role: 'resistance',
            },
            {
                kind: 'level',
                price: pivot,
                fromIndex: 15,
                label: 'P',
                role: 'neutral',
            },
            {
                kind: 'level',
                price: 2 * pivot - high,
                fromIndex: 15,
                label: 'S1',
                role: 'support',
            },
        ],
    };
};

export const STRATEGY_DEMOS: Record<string, () => GuideDemo> = {
    '52-week-high-momentum': week52HighMomentum,
    breakout,
    divergence,
    'elliott-wave': elliottWave,
    fibonacci,
    'gap-analysis': gapAnalysis,
    'ma-cycle': maCycle,
    'macd-cycle': macdCycle,
    'mean-reversion': meanReversion,
    'multi-timeframe': multiTimeframe,
    'pivot-points': pivotPoints,
};
