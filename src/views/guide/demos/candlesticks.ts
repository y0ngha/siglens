import { candle, concatBars, trendBars } from '@/views/guide/demos/generators';
import type {
    DemoBar,
    DemoOverlay,
    GuideDemo,
} from '@/views/guide/demos/types';

/**
 * 캔들 데모는 손으로 정한 OHLC 몇 개 + 앞쪽 추세 봉이다.
 * 각 항목이 core `detectCandlePatternEntries`로 실제 그 패턴으로 잡히는지는
 * `__tests__/candlesticks.test.ts`가 단언한다 (설명과 그림이 엔진과 어긋나지 않게).
 */

type Direction = 'up' | 'down';

/** 패턴 앞의 추세 봉. `end`는 마지막 종가로, 방향이 `down`이면 위에서 내려온다. */
function lead(
    direction: Direction,
    count: number,
    end: number,
    seed: number
): DemoBar[] {
    const travel = count * 1.6;
    return direction === 'down'
        ? trendBars(count, end + travel, end, {
              seed,
              rangePct: 0.012,
              noisePct: 0.002,
          })
        : trendBars(count, end - travel, end, {
              seed,
              rangePct: 0.012,
              noisePct: 0.002,
          });
}

function marker(
    i: number,
    label: string,
    tone: 'bull' | 'bear' | 'neutral',
    position: 'above' | 'below'
): DemoOverlay {
    return { kind: 'marker', i, label, tone, position };
}

function build(
    parts: readonly (readonly DemoBar[])[],
    overlays: readonly DemoOverlay[],
    highlight?: { fromIndex: number; toIndex: number }
): GuideDemo {
    return { bars: concatBars(...parts), overlays, highlight };
}

const bullishEngulfing = (): GuideDemo => {
    const pre = lead('down', 8, 100, 11);
    return build(
        [pre, [candle(100.4, 101, 97.5, 98), candle(97.4, 101.9, 97, 101.6)]],
        [marker(9, 'Bullish engulfing', 'bull', 'below')],
        { fromIndex: 8, toIndex: 9 }
    );
};

const bearishEngulfing = (): GuideDemo => {
    const pre = lead('up', 8, 100, 12);
    return build(
        [pre, [candle(99.6, 102.5, 99, 102), candle(102.6, 103.1, 98.8, 99)]],
        [marker(9, 'Bearish engulfing', 'bear', 'above')],
        { fromIndex: 8, toIndex: 9 }
    );
};

const hammerShootingStar = (): GuideDemo => {
    const down = lead('down', 6, 99, 13);
    const rebound = trendBars(6, 100.5, 111, {
        seed: 14,
        rangePct: 0.012,
        noisePct: 0.002,
    });
    return build(
        [
            down,
            [candle(99.2, 101.6, 94.6, 101.2)],
            rebound,
            [candle(112.6, 117.4, 111.4, 111.6)],
        ],
        [
            marker(6, 'Hammer', 'bull', 'below'),
            marker(13, 'Shooting star', 'bear', 'above'),
        ]
    );
};

const doji = (): GuideDemo =>
    build(
        [
            [
                candle(100, 103, 98.6, 101.4),
                candle(101.6, 104.4, 100.9, 103.2),
                candle(103.2, 106.2, 99.6, 103.3),
                candle(103.2, 104.6, 101.4, 102.2),
                candle(102.4, 102.7, 98, 102.5),
                candle(102.6, 106.4, 100.6, 104.2),
                candle(104.2, 108.6, 104.0, 104.1),
                candle(104.0, 105.2, 101.6, 102.6),
                candle(102.8, 106.0, 99.6, 104.4),
                candle(104.2, 106.6, 101.8, 103.3),
            ],
        ],
        [
            marker(2, 'Doji', 'neutral', 'above'),
            marker(4, 'Dragonfly', 'bull', 'below'),
            marker(6, 'Gravestone', 'bear', 'above'),
            marker(9, 'Spinning top', 'neutral', 'above'),
        ]
    );

const harami = (): GuideDemo => {
    const pre = lead('down', 5, 104, 15);
    return build(
        [
            pre,
            [
                candle(104.2, 104.6, 99.4, 99.8),
                candle(100.9, 102.9, 100.5, 102.2),
                candle(102.2, 103.1, 100.4, 100.9),
                candle(100.9, 101.2, 98.2, 98.7),
                candle(98.7, 99, 96.9, 97.3),
                candle(97.4, 97.6, 91.6, 92),
                candle(94.2, 96.6, 89.8, 94.3),
            ],
        ],
        [
            marker(6, 'Harami', 'bull', 'below'),
            marker(11, 'Harami cross', 'bull', 'below'),
        ],
        { fromIndex: 5, toIndex: 6 }
    );
};

const marubozu = (): GuideDemo =>
    build(
        [
            [
                candle(100.2, 101.6, 99.4, 100.6),
                candle(100.6, 101.4, 99.7, 100.2),
                candle(101, 106.2, 101, 106.2),
                candle(106.3, 107.4, 105.4, 106.1),
                candle(106.1, 107.1, 105.2, 106.4),
                candle(106.4, 107.2, 105.6, 106.6),
                candle(106.4, 106.4, 101.3, 101.3),
                candle(101, 101.8, 99.6, 100.2),
                candle(100.2, 101.4, 99.4, 100.9),
            ],
        ],
        [
            marker(2, 'Bullish marubozu', 'bull', 'above'),
            marker(6, 'Bearish marubozu', 'bear', 'above'),
        ]
    );

const morningEveningStar = (): GuideDemo => {
    const pre = lead('down', 6, 100.4, 16);
    return build(
        [
            pre,
            [
                candle(100.6, 100.9, 96.3, 96.8),
                candle(95.4, 96.5, 94.4, 95.8),
                candle(96, 101, 95.8, 100.6),
            ],
            trendBars(3, 101.4, 103.6, {
                seed: 17,
                rangePct: 0.012,
                noisePct: 0.002,
            }),
        ],
        [marker(8, 'Morning star', 'bull', 'below')],
        { fromIndex: 6, toIndex: 8 }
    );
};

const piercingDarkCloud = (): GuideDemo => {
    const pre = lead('down', 5, 102, 18);
    return build(
        [
            pre,
            [
                candle(102.4, 102.8, 97.2, 97.5),
                candle(95.8, 100.8, 95.4, 100.4),
            ],
            trendBars(3, 101.6, 106, {
                seed: 19,
                rangePct: 0.012,
                noisePct: 0.002,
            }),
            [
                candle(106.2, 111.6, 106, 111.2),
                candle(112.6, 113, 107.6, 108.2),
            ],
        ],
        [
            marker(6, 'Piercing line', 'bull', 'below'),
            marker(11, 'Dark cloud cover', 'bear', 'above'),
        ]
    );
};

const stomach = (): GuideDemo => {
    const pre = lead('down', 8, 102.4, 20);
    return build(
        [
            pre,
            [
                candle(102.4, 102.7, 97.3, 97.6),
                candle(100.4, 104.2, 100.1, 103.8),
            ],
        ],
        [marker(9, 'Above the stomach', 'bull', 'below')],
        { fromIndex: 8, toIndex: 9 }
    );
};

const threeInsideOutside = (): GuideDemo => {
    const pre = lead('down', 8, 104.2, 21);
    return build(
        [
            pre,
            [
                candle(104.4, 104.7, 99.8, 100.2),
                candle(101, 102.9, 100.8, 102.6),
                candle(102.7, 105.6, 102.5, 105.3),
            ],
        ],
        [marker(10, 'Three inside up', 'bull', 'below')],
        { fromIndex: 8, toIndex: 10 }
    );
};

const threeLineStrike = (): GuideDemo => {
    const pre = lead('up', 6, 108.6, 22);
    return build(
        [
            pre,
            [
                candle(108.4, 108.7, 105.2, 105.5),
                candle(105.4, 105.6, 102.4, 102.7),
                candle(102.6, 102.8, 99.6, 99.9),
                candle(99.4, 108.9, 99.2, 108.6),
            ],
        ],
        [marker(9, 'Three-line strike', 'bull', 'below')],
        { fromIndex: 6, toIndex: 9 }
    );
};

const threeMethods = (): GuideDemo => {
    const pre = lead('up', 6, 99.6, 23);
    return build(
        [
            pre,
            [
                candle(100, 106.2, 99.8, 106),
                candle(105.2, 105.9, 102.6, 103.6),
                candle(103.8, 104.6, 101.8, 102.4),
                candle(102.5, 104.2, 101.6, 103.6),
                candle(103.8, 110.4, 103.6, 110.2),
            ],
        ],
        [marker(10, 'Rising three methods', 'bull', 'below')],
        { fromIndex: 6, toIndex: 10 }
    );
};

const threeSoldiersCrows = (): GuideDemo => {
    const pre = lead('down', 8, 100, 24);
    return build(
        [
            pre,
            [
                candle(100.2, 103.3, 99.9, 103),
                candle(101.6, 106.2, 101.4, 105.8),
                candle(104.4, 108.8, 104.2, 108.5),
            ],
        ],
        [marker(10, 'Three white soldiers', 'bull', 'below')],
        { fromIndex: 8, toIndex: 10 }
    );
};

const tweezers = (): GuideDemo => {
    const pre = lead('down', 5, 101, 25);
    return build(
        [
            pre,
            [candle(101.2, 101.5, 97, 97.6), candle(97.8, 102.2, 97.04, 101.8)],
            trendBars(3, 103, 108, {
                seed: 26,
                rangePct: 0.012,
                noisePct: 0.002,
            }),
            [
                candle(108.2, 111, 108, 110.5),
                candle(110.8, 111.02, 108.6, 109.6),
            ],
        ],
        [
            marker(6, 'Tweezers bottom', 'bull', 'below'),
            marker(11, 'Tweezers top', 'bear', 'above'),
        ]
    );
};

const abandonedBaby = (): GuideDemo => {
    const pre = lead('down', 7, 104.2, 27);
    return build(
        [
            pre,
            [
                candle(104.4, 104.7, 99.9, 100.2),
                candle(97.6, 98.6, 96.6, 97.55),
                candle(99, 101.9, 98.8, 101.5),
            ],
        ],
        [marker(9, 'Abandoned baby', 'bull', 'below')],
        { fromIndex: 7, toIndex: 9 }
    );
};

const advanceBlockLadderBottom = (): GuideDemo => {
    const pre = lead('up', 6, 100, 28);
    return build(
        [
            pre,
            [
                candle(100.2, 103.4, 100, 103.1),
                candle(102.6, 106.4, 102.4, 104.8),
                candle(104.6, 108.4, 104.2, 105.5),
            ],
        ],
        [marker(8, 'Advance block', 'bear', 'above')],
        { fromIndex: 6, toIndex: 8 }
    );
};

const counterattackBeltHold = (): GuideDemo => {
    const pre = lead('down', 5, 98, 29);
    return build(
        [
            pre,
            [
                candle(99.6, 99.8, 97.7, 98),
                candle(98.4, 104.2, 98.35, 103.2),
                candle(103.3, 104.8, 102.9, 104.3),
                candle(104.1, 104.4, 101, 101.2),
                candle(98, 101.4, 97.8, 101.22),
            ],
        ],
        [
            marker(6, 'Belt hold', 'bull', 'below'),
            marker(9, 'Counterattack', 'bull', 'below'),
        ]
    );
};

const gapContinuation = (): GuideDemo => {
    const pre = lead('up', 6, 100, 30);
    return build(
        [
            pre,
            [
                candle(100.2, 103.2, 100, 103),
                candle(104.5, 107.5, 104.3, 107.2),
                candle(106.5, 106.8, 103.6, 103.8),
            ],
        ],
        [marker(8, 'Upside gap tasuki', 'bull', 'below')],
        { fromIndex: 6, toIndex: 8 }
    );
};

const gapTwoCrowsRabbits = (): GuideDemo => {
    const pre = lead('up', 6, 100, 31);
    return build(
        [
            pre,
            [
                candle(100.2, 104.8, 99.9, 104.5),
                candle(107, 107.4, 105.5, 105.8),
                candle(106.9, 107.1, 104.8, 105),
            ],
        ],
        [marker(8, 'Upside gap two crows', 'bear', 'above')],
        { fromIndex: 6, toIndex: 8 }
    );
};

const candleBasics = (): GuideDemo => ({
    bars: concatBars([
        candle(100, 111, 97, 108),
        candle(108, 112, 99, 102),
        candle(103, 112.5, 102.2, 104.2),
    ]),
    overlays: [
        {
            kind: 'line',
            from: { i: -0.42, price: 100 },
            to: { i: -0.12, price: 100 },
            role: 'neutral',
            label: 'Open',
        },
        {
            kind: 'line',
            from: { i: 0.12, price: 108 },
            to: { i: 0.42, price: 108 },
            role: 'neutral',
            label: 'Close',
        },
        {
            kind: 'line',
            from: { i: 0.58, price: 108 },
            to: { i: 0.88, price: 108 },
            role: 'neutral',
            label: 'Open',
        },
        {
            kind: 'line',
            from: { i: 1.12, price: 102 },
            to: { i: 1.42, price: 102 },
            role: 'neutral',
            label: 'Close',
        },
        marker(0, 'High', 'neutral', 'above'),
        marker(0, 'Low', 'neutral', 'below'),
        marker(1, 'High', 'neutral', 'above'),
        marker(1, 'Low', 'neutral', 'below'),
        marker(2, 'Upper wick', 'neutral', 'above'),
        marker(2, 'Lower wick', 'neutral', 'below'),
    ],
});

export const CANDLESTICK_DEMOS: Record<string, () => GuideDemo> = {
    'abandoned-baby-tri-star': abandonedBaby,
    'advance-block-ladder-bottom': advanceBlockLadderBottom,
    'bearish-engulfing': bearishEngulfing,
    'bullish-engulfing': bullishEngulfing,
    'candle-basics': candleBasics,
    'counterattack-belt-hold': counterattackBeltHold,
    doji,
    'gap-continuation': gapContinuation,
    'gap-two-crows-rabbits': gapTwoCrowsRabbits,
    'hammer-shooting-star': hammerShootingStar,
    harami,
    marubozu,
    'morning-evening-star': morningEveningStar,
    'piercing-dark-cloud': piercingDarkCloud,
    stomach,
    'three-inside-outside': threeInsideOutside,
    'three-line-strike': threeLineStrike,
    'three-methods': threeMethods,
    'three-soldiers-crows': threeSoldiersCrows,
    tweezers,
};
