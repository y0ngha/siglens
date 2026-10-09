import {
    calculateIndicators,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { toCoreBars } from '@/views/guide/demos/generators';
import {
    DIVERGENCE_LOW_1,
    DIVERGENCE_LOW_2,
    getDivergenceSeries,
    getSharedSeries,
    type SharedSeries,
} from '@/views/guide/demos/sharedSeries';
import type {
    DemoBar,
    DemoBarTone,
    DemoOverlay,
    DemoPane,
    GuideDemo,
} from '@/views/guide/demos/types';

/**
 * 지표 데모는 공통 합성 시세(`sharedSeries.ts`)의 한 구간을 잘라 core `calculateIndicators`가
 * 계산한 **실제 값**을 그린다. 값은 이 파일이 만들지 않고 구간만 고른다.
 */

type Num = number | null;
export type Tone = 'bull' | 'bear' | 'neutral';

export interface Ctx {
    r: IndicatorResult;
    bars: DemoBar[];
    start: number;
    /** 시세 전체 기준 인덱스를 구간 인덱스로 바꾼다. */
    at: (abs: number) => number;
    /** 시세 전체 길이의 배열을 구간으로 자른다. */
    s: <T>(values: readonly T[]) => T[];
    /** 구간 안에서 조건을 처음 만족하는 구간 인덱스 (없으면 -1). */
    find: (test: (abs: number) => boolean) => number;
}

const WINDOW = 90;

export function windowed(
    start: number,
    build: (ctx: Ctx) => Omit<GuideDemo, 'bars'> & { bars?: DemoBar[] },
    source: () => SharedSeries = getSharedSeries,
    length: number = WINDOW
): () => GuideDemo {
    return () => {
        const { bars, result } = source();
        const end = Math.min(bars.length, start + length);
        const ctx: Ctx = {
            r: result,
            bars: bars.slice(start, end),
            start,
            at: abs => abs - start,
            s: values => values.slice(start, end),
            find: test => {
                for (let abs = start; abs < end; abs++) {
                    if (test(abs)) return abs - start;
                }
                return -1;
            },
        };
        return { bars: ctx.bars, ...build(ctx) };
    };
}

export const marker = (
    i: number,
    label: string,
    tone: Tone,
    position: 'above' | 'below' = 'above'
): DemoOverlay[] =>
    i < 0 ? [] : [{ kind: 'marker', i, label, tone, position }];

export const num = (value: Num | undefined): number => value ?? Number.NaN;

/** 위로 교차한(이전엔 a <= b, 지금은 a > b) 첫 절대 인덱스 조건. */
export const crossedUp =
    (a: readonly Num[], b: readonly Num[]) =>
    (abs: number): boolean =>
        abs > 0 &&
        num(a[abs]) > num(b[abs]) &&
        num(a[abs - 1]) <= num(b[abs - 1]);

export const crossedDown =
    (a: readonly Num[], b: readonly Num[]) =>
    (abs: number): boolean =>
        abs > 0 &&
        num(a[abs]) < num(b[abs]) &&
        num(a[abs - 1]) >= num(b[abs - 1]);

/** 구간 시작에서 `offset`봉 이후에 처음 `test`를 만족하는 구간 인덱스. */
export const firstAfter = (
    c: Ctx,
    offset: number,
    test: (abs: number) => boolean
): number => c.find(abs => abs >= c.start + offset && test(abs));

export const maOf = (r: IndicatorResult, period: number): readonly Num[] =>
    r.ma[period] ?? [];
export const emaOf = (r: IndicatorResult, period: number): readonly Num[] =>
    r.ema[period] ?? [];

/** 표준 EMA (첫 값은 SMA로 시작). 엘더 레이의 13일 EMA처럼 core가 따로 내지 않는 선에만 쓴다. */
function ema(values: readonly number[], period: number): Num[] {
    const k = 2 / (period + 1);
    const out: Num[] = [];
    let prev = 0;
    values.forEach((value, index) => {
        if (index < period - 1) {
            out.push(null);
            prev += value;
            return;
        }
        prev =
            index === period - 1
                ? (prev + value) / period
                : value * k + prev * (1 - k);
        out.push(prev);
    });
    return out;
}

/** 방향 배열로 한 선을 위/아래 두 갈래(null로 끊김)로 나눈다. */
export function splitByDirection(
    values: readonly Num[],
    isUp: (index: number) => boolean | null
): { up: Num[]; down: Num[] } {
    const up: Num[] = [];
    const down: Num[] = [];
    values.forEach((value, index) => {
        const direction = isUp(index);
        up.push(direction === true ? value : null);
        down.push(direction === false ? value : null);
    });
    return { up, down };
}

export const pane = (
    label: string,
    rest: Omit<DemoPane, 'label'>
): DemoPane => ({ label, ...rest });

/** 가격 위에 이동평균류 선을 얹는다. */
export const overlayLine = (
    values: readonly Num[],
    label: string,
    tone: 'a' | 'b' | 'c' | 'bull' | 'bear'
): DemoOverlay => ({
    kind: 'series',
    values,
    label,
    tone,
});

/** core는 변동성을 일간 수익률 비율(0.012)로 내므로 화면에서는 퍼센트(1.2)로 바꾼다. */
const percent = (values: readonly Num[]): Num[] =>
    values.map(v => (v === null ? null : v * 100));

const rsiDemo = windowed(20, c => {
    const idx = c.find(abs => abs >= c.start + 30 && num(c.r.rsi[abs]) > 70);
    return {
        overlays: marker(idx, 'RSI > 70', 'bear'),
        panes: [
            pane('RSI 14', {
                lines: [{ values: c.s(c.r.rsi), label: '', tone: 'a' }],
                levels: [{ value: 70 }, { value: 30 }],
                range: [0, 100],
            }),
        ],
    };
});

const macdDemo = windowed(55, c => {
    const idx = c.find(
        abs =>
            abs >= c.start + 40 &&
            crossedUp(
                c.r.macd.map(m => m.macd),
                c.r.macd.map(m => m.signal)
            )(abs)
    );
    return {
        overlays: marker(idx, 'Cross up', 'bull', 'below'),
        panes: [
            pane('12-26-9', {
                lines: [
                    {
                        values: c.s(c.r.macd.map(m => m.macd)),
                        label: 'MACD',
                        tone: 'a',
                    },
                    {
                        values: c.s(c.r.macd.map(m => m.signal)),
                        label: 'Signal',
                        tone: 'b',
                    },
                ],
                histogram: c.s(c.r.macd.map(m => m.histogram)),
                levels: [{ value: 0 }],
                height: 96,
            }),
        ],
    };
});

const maDemo = windowed(170, c => {
    const idx = c.find(crossedUp(maOf(c.r, 20), maOf(c.r, 60)));
    return {
        overlays: [
            overlayLine(c.s(maOf(c.r, 20)), 'MA20', 'a'),
            overlayLine(c.s(maOf(c.r, 60)), 'MA60', 'b'),
            ...marker(idx, 'Golden cross', 'bull', 'below'),
        ],
    };
});

const emaDemo = windowed(40, c => ({
    overlays: [
        overlayLine(c.s(emaOf(c.r, 9)), 'EMA9', 'a'),
        overlayLine(c.s(emaOf(c.r, 20)), 'EMA20', 'b'),
        overlayLine(c.s(emaOf(c.r, 60)), 'EMA60', 'c'),
    ],
}));

const bollingerDemo = windowed(30, c => ({
    overlays: [
        {
            kind: 'band',
            upper: c.s(c.r.bollinger.map(b => b.upper)),
            lower: c.s(c.r.bollinger.map(b => b.lower)),
            label: '',
            tone: 'a',
        },
        overlayLine(c.s(c.r.bollinger.map(b => b.middle)), 'MA20', 'c'),
    ],
}));

const percentBDemo = windowed(20, c => {
    const pctB = c.r.bollingerDerived.map(b => b.pctB);
    const idx = firstAfter(
        c,
        40,
        abs => num(pctB[abs]) < 0.95 && num(pctB[abs - 1]) >= 0.95
    );
    return {
        overlays: [
            {
                kind: 'band',
                upper: c.s(c.r.bollinger.map(b => b.upper)),
                lower: c.s(c.r.bollinger.map(b => b.lower)),
                label: '',
                tone: 'c',
            },
            ...marker(idx, '%B < 0.95', 'bear'),
        ],
        panes: [
            pane('%B', {
                lines: [{ values: c.s(pctB), label: '', tone: 'a' }],
                levels: [{ value: 0.95 }, { value: 0.5 }, { value: 0.05 }],
                range: [-0.2, 1.2],
            }),
        ],
    };
});

const buySellVolumeDemo = windowed(20, c => ({
    panes: [
        pane('Volume split', {
            lines: [
                {
                    values: c.s(c.r.buySellVolume.map(v => v.buyVolume)),
                    label: 'Buy',
                    tone: 'bull',
                },
                {
                    values: c.s(c.r.buySellVolume.map(v => v.sellVolume)),
                    label: 'Sell',
                    tone: 'bear',
                },
            ],
        }),
    ],
}));

const cciDemo = windowed(30, c => {
    const up = firstAfter(
        c,
        20,
        abs => num(c.r.cci[abs]) > 100 && num(c.r.cci[abs - 1]) <= 100
    );
    const down = firstAfter(
        c,
        up + 1,
        abs => num(c.r.cci[abs]) < 100 && num(c.r.cci[abs - 1]) >= 100
    );
    return {
        overlays: [
            ...marker(up, 'CCI > 100', 'bear'),
            ...marker(down, 'Back below', 'neutral'),
        ],
        panes: [
            pane('CCI 20', {
                lines: [{ values: c.s(c.r.cci), label: '', tone: 'a' }],
                levels: [{ value: 100 }, { value: 0 }, { value: -100 }],
            }),
        ],
    };
});

const chandelierDemo = windowed(100, c => {
    const trend = c.r.chandelierExit.map(x => x.trend);
    const stops = c.r.chandelierExit.map(x =>
        x.trend === 'long' ? x.longStop : x.shortStop
    );
    const { up, down } = splitByDirection(c.s(stops), index => {
        const t = c.s(trend)[index];
        return t === null ? null : t === 'long';
    });
    const flip = c.find(
        abs => trend[abs] === 'short' && trend[abs - 1] === 'long'
    );
    return {
        overlays: [
            overlayLine(up, 'Long stop', 'bull'),
            overlayLine(down, '', 'bear'),
            ...marker(flip, 'Exit', 'bear'),
        ],
    };
});

const cmfDemo = windowed(20, c => ({
    panes: [
        pane('CMF 20', { histogram: c.s(c.r.cmf), levels: [{ value: 0 }] }),
    ],
}));

const connorsDemo = windowed(150, c => {
    const idx = firstAfter(
        c,
        5,
        abs =>
            num(c.r.connorsRsi[abs]) < 10 && num(c.r.connorsRsi[abs - 1]) >= 10
    );
    return {
        overlays: marker(idx, 'CRSI < 10', 'bull', 'below'),
        panes: [
            pane('Connors RSI', {
                lines: [{ values: c.s(c.r.connorsRsi), label: '', tone: 'a' }],
                levels: [{ value: 90 }, { value: 10 }],
                range: [0, 100],
            }),
        ],
    };
});

const dmiDemo = windowed(95, c => ({
    overlays: marker(
        firstAfter(
            c,
            10,
            crossedUp(
                c.r.dmi.map(d => d.diPlus),
                c.r.dmi.map(d => d.diMinus)
            )
        ),
        '+DI > -DI',
        'bull',
        'below'
    ),
    panes: [
        pane('DMI 14', {
            lines: [
                {
                    values: c.s(c.r.dmi.map(d => d.diPlus)),
                    label: '+DI',
                    tone: 'bull',
                },
                {
                    values: c.s(c.r.dmi.map(d => d.diMinus)),
                    label: '-DI',
                    tone: 'bear',
                },
                {
                    values: c.s(c.r.dmi.map(d => d.adx)),
                    label: 'ADX',
                    tone: 'c',
                },
            ],
            height: 92,
        }),
    ],
}));

const donchianDemo = windowed(20, c => ({
    overlays: [
        {
            kind: 'band',
            upper: c.s(c.r.donchianChannel.map(d => d.upper)),
            lower: c.s(c.r.donchianChannel.map(d => d.lower)),
            label: '',
            tone: 'a',
        },
        overlayLine(c.s(c.r.donchianChannel.map(d => d.middle)), 'Mid', 'c'),
        ...marker(
            firstAfter(
                c,
                40,
                abs =>
                    c.bars[abs - c.start].close >
                    num(c.r.donchianChannel[abs - 1].upper)
            ),
            'Breakout',
            'bull',
            'below'
        ),
    ],
}));

const IMPULSE_TONE: Record<string, DemoBarTone> = {
    green: 'bull',
    red: 'bear',
    blue: 'neutral',
};

const elderImpulseDemo = windowed(20, c => {
    const colors = c.s(c.r.elderImpulse);
    // 임펄스는 봉 색으로 표시한다: 녹색(상승 동력), 청색(중립), 적색(하락 동력).
    return {
        bars: c.bars.map((bar, i) => ({
            ...bar,
            tone: IMPULSE_TONE[colors[i] ?? 'blue'],
        })),
        overlays: [overlayLine(c.s(emaOf(c.r, 20)), 'EMA20', 'c')],
    };
});

const elderRayDemo = windowed(40, c => {
    const closeOrHigh = getSharedSeries().bars.map(b => b.close);
    const ema13 = ema(closeOrHigh, 13);
    return {
        overlays: [overlayLine(c.s(ema13), 'EMA13', 'a')],
        panes: [
            pane('Bull power', {
                histogram: c.s(c.r.elderRay.map(e => e.bullPower)),
                levels: [{ value: 0 }],
                height: 62,
            }),
            pane('Bear power', {
                histogram: c.s(c.r.elderRay.map(e => e.bearPower)),
                levels: [{ value: 0 }],
                height: 62,
            }),
        ],
    };
});

const ewmaDemo = windowed(150, c => {
    let worst = 1;
    for (let i = 1; i < c.bars.length; i++) {
        if (
            c.bars[i].close - c.bars[i - 1].close <
            c.bars[worst].close - c.bars[worst - 1].close
        )
            worst = i;
    }
    return {
        overlays: marker(worst, 'Big drop', 'bear'),
        panes: [
            pane('EWMA volatility (%)', {
                lines: [
                    {
                        values: percent(c.s(c.r.ewmaVolatility)),
                        label: '',
                        tone: 'a',
                    },
                ],
            }),
        ],
    };
});

const hurstDemo = windowed(
    90,
    c => ({
        panes: [
            pane('Hurst', {
                lines: [{ values: c.s(c.r.hurst), label: '', tone: 'a' }],
                levels: [{ value: 0.5 }],
            }),
        ],
    }),
    getSharedSeries,
    100
);

const ichimokuDemo = windowed(30, c => ({
    overlays: [
        {
            kind: 'band',
            upper: c.s(c.r.ichimoku.map(x => x.senkouA)),
            lower: c.s(c.r.ichimoku.map(x => x.senkouB)),
            label: 'Cloud',
            tone: 'c',
        },
        overlayLine(c.s(c.r.ichimoku.map(x => x.tenkan)), 'Tenkan', 'a'),
        overlayLine(c.s(c.r.ichimoku.map(x => x.kijun)), 'Kijun', 'b'),
    ],
}));

const keltnerDemo = windowed(20, c => ({
    overlays: [
        {
            kind: 'band',
            upper: c.s(c.r.keltnerChannel.map(k => k.upper)),
            lower: c.s(c.r.keltnerChannel.map(k => k.lower)),
            label: '',
            tone: 'b',
        },
        overlayLine(c.s(c.r.keltnerChannel.map(k => k.middle)), 'EMA20', 'c'),
        ...marker(
            firstAfter(
                c,
                10,
                abs =>
                    c.bars[abs - c.start].close >
                    num(c.r.keltnerChannel[abs].upper)
            ),
            'Close above',
            'bull',
            'below'
        ),
    ],
}));

const macdVDemo = windowed(30, c => ({
    overlays: marker(
        firstAfter(
            c,
            10,
            abs => num(c.r.macdV[abs]) < 150 && num(c.r.macdV[abs - 1]) >= 150
        ),
        'Back below 150',
        'bear'
    ),
    panes: [
        pane('MACD-V', {
            lines: [{ values: c.s(c.r.macdV), label: '', tone: 'a' }],
            levels: [{ value: 150 }, { value: 0 }, { value: -150 }],
        }),
    ],
}));

const mfiDemo = windowed(110, c => ({
    overlays: marker(
        firstAfter(
            c,
            10,
            abs => num(c.r.mfi[abs]) > 20 && num(c.r.mfi[abs - 1]) <= 20
        ),
        'MFI back above 20',
        'bull',
        'below'
    ),
    panes: [
        pane('MFI 14', {
            lines: [{ values: c.s(c.r.mfi), label: '', tone: 'a' }],
            levels: [{ value: 80 }, { value: 20 }],
            range: [0, 100],
        }),
    ],
}));

const obvDemo = windowed(
    0,
    c => ({
        overlays: [
            ...marker(c.at(DIVERGENCE_LOW_1), 'Low 1', 'neutral', 'below'),
            ...marker(c.at(DIVERGENCE_LOW_2), 'Lower low', 'bear', 'below'),
        ],
        panes: [
            pane('OBV', {
                lines: [{ values: c.s(c.r.obv), label: '', tone: 'a' }],
            }),
        ],
    }),
    getDivergenceSeries,
    105
);

const forceIndexDemo = windowed(
    0,
    c => ({
        overlays: [
            ...marker(c.at(DIVERGENCE_LOW_1), 'Low 1', 'neutral', 'below'),
            ...marker(c.at(DIVERGENCE_LOW_2), 'Lower low', 'bear', 'below'),
        ],
        panes: [
            pane('Force Index', {
                lines: [{ values: c.s(c.r.forceIndex), label: '', tone: 'a' }],
                levels: [{ value: 0 }],
            }),
        ],
    }),
    getDivergenceSeries,
    105
);

const parabolicSarDemo = windowed(40, c => {
    const sar = c.r.parabolicSar;
    const { up, down } = splitByDirection(c.s(sar.map(x => x.sar)), index => {
        const t = c.s(sar.map(x => x.trend))[index];
        return t === null ? null : t === 'up';
    });
    return {
        overlays: [
            {
                kind: 'series',
                values: up,
                label: 'SAR',
                tone: 'bull',
                style: 'dots',
            },
            {
                kind: 'series',
                values: down,
                label: '',
                tone: 'bear',
                style: 'dots',
            },
        ],
    };
});

const regressionDemo = windowed(
    50,
    c => ({
        panes: [
            pane('R²', {
                lines: [
                    {
                        values: c.s(c.r.regression.map(x => x.r2)),
                        label: '',
                        tone: 'a',
                    },
                ],
                levels: [{ value: 0.8 }, { value: 0.3 }],
                range: [0, 1],
            }),
        ],
    }),
    getSharedSeries,
    100
);

const smcDemo = windowed(
    190,
    c => {
        const { smc } = c.r;
        const overlays: DemoOverlay[] = [];
        smc.structureBreaks
            .filter(
                b => b.index >= c.start && b.index < c.start + c.bars.length
            )
            .forEach(b => {
                overlays.push(
                    ...marker(
                        c.at(b.index),
                        b.breakType === 'bos' ? 'BOS' : 'CHoCH',
                        b.type === 'bullish' ? 'bull' : 'bear',
                        b.type === 'bullish' ? 'below' : 'above'
                    )
                );
            });
        const lastEnd = c.start + c.bars.length - 1;
        const block = smc.orderBlocks
            .toReversed()
            .find(o => o.type === 'bullish' && o.startIndex >= c.start);
        if (block !== undefined) {
            overlays.push({
                kind: 'zone',
                fromIndex: c.at(block.startIndex),
                toIndex: c.at(lastEnd),
                low: block.low,
                high: block.high,
                label: 'Order block',
            });
        }
        const gap = smc.fairValueGaps
            .toReversed()
            .find(f => f.type === 'bullish' && f.index >= c.start);
        if (gap !== undefined) {
            overlays.push({
                kind: 'zone',
                fromIndex: c.at(gap.index - 1),
                toIndex: c.at(gap.index + 1),
                low: gap.low,
                high: gap.high,
                label: 'FVG',
            });
        }
        return { overlays };
    },
    getSharedSeries,
    70
);

const squeezeDemo = windowed(60, c => {
    const sq = c.r.squeezeMomentum;
    const release = c.find(
        abs =>
            sq[abs].sqzOff === true &&
            sq[abs - 1].sqzOn === true &&
            abs >= c.start + 30
    );
    let from = release;
    while (from > 0 && sq[c.start + from - 1].sqzOn === true) from--;
    return {
        overlays: marker(release, 'Release', 'bull', 'below'),
        highlight:
            release > 0
                ? { fromIndex: from, toIndex: Math.max(from, release - 1) }
                : undefined,
        panes: [
            pane('Momentum', {
                histogram: c.s(sq.map(x => x.momentum)),
                levels: [{ value: 0 }],
            }),
        ],
    };
});

const stochRsiDemo = windowed(170, c => ({
    overlays: marker(
        firstAfter(
            c,
            25,
            abs =>
                crossedUp(
                    c.r.stochRsi.map(x => x.k),
                    c.r.stochRsi.map(x => x.d)
                )(abs) && num(c.r.stochRsi[abs].k) < 0.3
        ),
        '%K up through %D',
        'bull',
        'below'
    ),
    panes: [
        pane('Stoch RSI', {
            lines: [
                {
                    values: c.s(c.r.stochRsi.map(x => x.k)),
                    label: '%K',
                    tone: 'a',
                },
                {
                    values: c.s(c.r.stochRsi.map(x => x.d)),
                    label: '%D',
                    tone: 'b',
                },
            ],
            levels: [{ value: 0.8 }, { value: 0.2 }],
            range: [0, 1],
        }),
    ],
}));

const stochasticDemo = windowed(170, c => ({
    overlays: marker(
        firstAfter(
            c,
            45,
            abs =>
                crossedUp(
                    c.r.stochastic.map(x => x.percentK),
                    c.r.stochastic.map(x => x.percentD)
                )(abs) && num(c.r.stochastic[abs].percentK) < 25
        ),
        '%K up through %D',
        'bull',
        'below'
    ),
    panes: [
        pane('Stochastic', {
            lines: [
                {
                    values: c.s(c.r.stochastic.map(x => x.percentK)),
                    label: '%K',
                    tone: 'a',
                },
                {
                    values: c.s(c.r.stochastic.map(x => x.percentD)),
                    label: '%D',
                    tone: 'b',
                },
            ],
            levels: [{ value: 80 }, { value: 20 }],
            range: [0, 100],
        }),
    ],
}));

const supertrendDemo = windowed(100, c => {
    const st = c.r.supertrend;
    const { up, down } = splitByDirection(
        c.s(st.map(x => x.supertrend)),
        index => {
            const t = c.s(st.map(x => x.trend))[index];
            return t === null ? null : t === 'up';
        }
    );
    return {
        overlays: [
            overlayLine(up, 'Supertrend', 'bull'),
            overlayLine(down, '', 'bear'),
            ...marker(
                c.find(
                    abs =>
                        st[abs].trend !== st[abs - 1].trend &&
                        st[abs - 1].trend !== null
                ),
                'Flip',
                'bear'
            ),
        ],
    };
});

const varianceRatioDemo = windowed(
    50,
    c => ({
        panes: [
            pane('Variance ratio', {
                lines: [
                    { values: c.s(c.r.varianceRatio), label: '', tone: 'a' },
                ],
                levels: [{ value: 1 }],
            }),
        ],
    }),
    getSharedSeries,
    100
);

const volumeProfileDemo = windowed(100, c => {
    const profile = calculateIndicators(toCoreBars(c.bars)).volumeProfile;
    if (profile === null) return {};
    return {
        overlays: [
            { kind: 'profile', rows: profile.profile },
            {
                kind: 'level',
                price: profile.vah,
                label: 'VAH',
                role: 'neutral',
            },
            {
                kind: 'level',
                price: profile.poc,
                label: 'POC',
                role: 'resistance',
            },
            {
                kind: 'level',
                price: profile.val,
                label: 'VAL',
                role: 'neutral',
            },
        ],
    };
});

const vwapDemo = windowed(
    30,
    c => {
        const vwap = calculateIndicators(toCoreBars(c.bars)).vwap;
        const idx = c.bars.findIndex(
            (bar, i) =>
                i > 5 &&
                bar.close > num(vwap[i]) &&
                c.bars[i - 1].close <= num(vwap[i - 1])
        );
        return {
            overlays: [
                overlayLine(vwap, 'VWAP', 'a'),
                ...marker(idx, 'Above VWAP', 'bull', 'below'),
            ],
            panes: [
                pane('Volume', {
                    histogram: c.bars.map(b => b.volume ?? 0),
                    histogramTones: c.bars.map(b =>
                        b.close >= b.open ? 'bull' : 'bear'
                    ),
                    height: 60,
                }),
            ],
        };
    },
    getSharedSeries,
    70
);

const williamsDemo = windowed(170, c => ({
    overlays: marker(
        firstAfter(
            c,
            45,
            abs =>
                num(c.r.williamsR[abs]) > -80 &&
                num(c.r.williamsR[abs - 1]) <= -80
        ),
        '%R above -80',
        'bull',
        'below'
    ),
    panes: [
        pane('Williams %R', {
            lines: [{ values: c.s(c.r.williamsR), label: '', tone: 'a' }],
            levels: [{ value: -20 }, { value: -80 }],
            range: [-100, 0],
        }),
    ],
}));

const yangZhangDemo = windowed(150, c => ({
    panes: [
        pane('Yang-Zhang volatility (%)', {
            lines: [
                { values: percent(c.s(c.r.yangZhang)), label: '', tone: 'a' },
            ],
        }),
    ],
}));

const adxDemo = windowed(120, c => ({
    panes: [
        pane('ADX 14', {
            lines: [
                { values: c.s(c.r.dmi.map(d => d.adx)), label: '', tone: 'a' },
            ],
            levels: [{ value: 25 }],
        }),
    ],
}));

const atrDemo = windowed(100, c => ({
    panes: [
        pane('ATR 14', {
            lines: [{ values: c.s(c.r.atr), label: '', tone: 'a' }],
        }),
    ],
}));

export const INDICATOR_DEMOS: Record<string, () => GuideDemo> = {
    adx: adxDemo,
    atr: atrDemo,
    'bollinger-bands': bollingerDemo,
    'bollinger-percent-b': percentBDemo,
    'buy-sell-volume': buySellVolumeDemo,
    cci: cciDemo,
    'chandelier-exit': chandelierDemo,
    cmf: cmfDemo,
    'connors-rsi': connorsDemo,
    dmi: dmiDemo,
    'donchian-channel': donchianDemo,
    'elder-impulse': elderImpulseDemo,
    'elder-ray': elderRayDemo,
    ema: emaDemo,
    'ewma-volatility': ewmaDemo,
    'force-index': forceIndexDemo,
    hurst: hurstDemo,
    'ichimoku-cloud': ichimokuDemo,
    'keltner-channel': keltnerDemo,
    ma: maDemo,
    macd: macdDemo,
    'macd-v': macdVDemo,
    mfi: mfiDemo,
    obv: obvDemo,
    'parabolic-sar': parabolicSarDemo,
    'regression-r2': regressionDemo,
    rsi: rsiDemo,
    'smart-money-concepts': smcDemo,
    'squeeze-momentum': squeezeDemo,
    stochastic: stochasticDemo,
    'stochastic-rsi': stochRsiDemo,
    supertrend: supertrendDemo,
    'variance-ratio': varianceRatioDemo,
    'volume-profile': volumeProfileDemo,
    vwap: vwapDemo,
    'williams-r': williamsDemo,
    'yang-zhang': yangZhangDemo,
};
