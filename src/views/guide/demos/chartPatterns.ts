import { pathToBars } from '@/views/guide/demos/generators';
import type {
    DemoBar,
    DemoLineRole,
    DemoOverlay,
    GuideDemo,
} from '@/views/guide/demos/types';

/**
 * 차트 패턴 데모는 꼭짓점(웨이포인트) 목록에서 시드 고정 노이즈 봉을 만들고,
 * 넥라인·추세선·돌파 마커를 **같은 꼭짓점에서** 계산한다. 선이 그림과 어긋날 수 없다.
 */

type Point = { i: number; price: number };

const pt = (i: number, price: number): Point => ({ i, price });

/** 두 점을 지나는 직선의 i에서의 값. */
function lineAt(a: Point, b: Point): (i: number) => number {
    const slope = (b.price - a.price) / (b.i - a.i);
    return i => a.price + slope * (i - a.i);
}

/** a→b 직선을 endI까지 이어 그린 선 오버레이. */
function ray(
    a: Point,
    b: Point,
    endI: number,
    role: DemoLineRole,
    label?: string
): DemoOverlay {
    return {
        kind: 'line',
        from: a,
        to: pt(endI, lineAt(a, b)(endI)),
        role,
        label,
    };
}

/** from 이후 종가가 기준선을 처음 넘어선(또는 깨고 내려간) 봉의 인덱스. */
function breakIndex(
    bars: readonly DemoBar[],
    from: number,
    line: (i: number) => number,
    direction: 'above' | 'below'
): number {
    for (let i = from; i < bars.length; i++) {
        const beyond =
            direction === 'above'
                ? bars[i].close > line(i)
                : bars[i].close < line(i);
        if (beyond) return i;
    }
    return bars.length - 1;
}

function breakMarker(index: number, direction: 'above' | 'below'): DemoOverlay {
    return direction === 'above'
        ? {
              kind: 'marker',
              i: index,
              label: 'Breakout',
              tone: 'bull',
              position: 'below',
          }
        : {
              kind: 'marker',
              i: index,
              label: 'Breakdown',
              tone: 'bear',
              position: 'above',
          };
}

function peakMarkers(
    points: readonly Point[],
    labels: readonly string[],
    position: 'above' | 'below'
): DemoOverlay[] {
    return points.map((point, index) => ({
        kind: 'marker',
        i: point.i,
        label: labels[index],
        tone: 'neutral',
        position,
    }));
}

/** 물결 없이 이어지는 곡선(컵·접시·돔)을 촘촘한 꼭짓점으로 만든다. */
function curve(
    fromI: number,
    toI: number,
    step: number,
    priceAt: (i: number) => number
): Point[] {
    const count = Math.ceil((toI - fromI) / step);
    return [
        ...Array.from({ length: Math.max(count, 0) }, (_, k) => {
            const i = fromI + k * step;
            return pt(i, priceAt(i));
        }),
        pt(toI, priceAt(toI)),
    ];
}

function build(
    seed: number,
    waypoints: readonly Point[],
    overlays: (bars: readonly DemoBar[]) => DemoOverlay[],
    rangePct?: number
): GuideDemo {
    const bars = pathToBars(waypoints, {
        seed,
        rangePct: rangePct ?? 0.016,
        noisePct: 0.005,
    });
    return { bars, overlays: overlays(bars) };
}

const doubleTop = (): GuideDemo => {
    const top1 = pt(12, 108);
    const top2 = pt(32, 108);
    const neck = lineAt(pt(22, 97), pt(32, 97));
    return build(41, [pt(0, 88), top1, pt(22, 97), top2, pt(46, 86)], bars => [
        ray(pt(12, 97), pt(32, 97), 46, 'neckline', 'Neckline'),
        ...peakMarkers([top1, top2], ['Top 1', 'Top 2'], 'above'),
        breakMarker(breakIndex(bars, 33, neck, 'below'), 'below'),
    ]);
};

const doubleBottom = (): GuideDemo => {
    const low1 = pt(12, 92);
    const low2 = pt(32, 92);
    const neck = lineAt(pt(22, 103), pt(32, 103));
    return build(
        42,
        [pt(0, 112), low1, pt(22, 103), low2, pt(46, 114)],
        bars => [
            ray(pt(12, 103), pt(32, 103), 46, 'neckline', 'Neckline'),
            ...peakMarkers([low1, low2], ['Bottom 1', 'Bottom 2'], 'below'),
            breakMarker(breakIndex(bars, 33, neck, 'above'), 'above'),
        ]
    );
};

const tripleTop = (): GuideDemo => {
    const tops = [pt(10, 106), pt(26, 106), pt(42, 106)];
    const neck = lineAt(pt(18, 96), pt(34, 96));
    return build(
        43,
        [
            pt(0, 86),
            tops[0],
            pt(18, 96),
            tops[1],
            pt(34, 96),
            tops[2],
            pt(56, 82),
        ],
        bars => [
            ray(pt(10, 96), pt(34, 96), 56, 'neckline', 'Neckline'),
            ...peakMarkers(tops, ['Top 1', 'Top 2', 'Top 3'], 'above'),
            breakMarker(breakIndex(bars, 43, neck, 'below'), 'below'),
        ]
    );
};

const tripleBottom = (): GuideDemo => {
    const lows = [pt(10, 94), pt(26, 94), pt(42, 94)];
    const neck = lineAt(pt(18, 104), pt(34, 104));
    return build(
        44,
        [
            pt(0, 114),
            lows[0],
            pt(18, 104),
            lows[1],
            pt(34, 104),
            lows[2],
            pt(56, 118),
        ],
        bars => [
            ray(pt(10, 104), pt(34, 104), 56, 'neckline', 'Neckline'),
            ...peakMarkers(lows, ['Bottom 1', 'Bottom 2', 'Bottom 3'], 'below'),
            breakMarker(breakIndex(bars, 43, neck, 'above'), 'above'),
        ]
    );
};

const headAndShoulders = (): GuideDemo => {
    const t1 = pt(17, 92);
    const t2 = pt(31, 93);
    const neck = lineAt(t1, t2);
    return build(
        45,
        [pt(0, 80), pt(10, 101), t1, pt(24, 113), t2, pt(38, 101), pt(54, 80)],
        bars => [
            ray(pt(8, neck(8)), t2, 54, 'neckline', 'Neckline'),
            ...peakMarkers(
                [pt(10, 101), pt(24, 113), pt(38, 101)],
                ['L. shoulder', 'Head', 'R. shoulder'],
                'above'
            ),
            breakMarker(breakIndex(bars, 39, neck, 'below'), 'below'),
        ]
    );
};

const inverseHeadAndShoulders = (): GuideDemo => {
    const p1 = pt(17, 112);
    const p2 = pt(31, 111);
    const neck = lineAt(p1, p2);
    return build(
        46,
        [pt(0, 126), pt(10, 103), p1, pt(24, 91), p2, pt(38, 103), pt(54, 124)],
        bars => [
            ray(pt(8, neck(8)), p2, 54, 'neckline', 'Neckline'),
            ...peakMarkers(
                [pt(10, 103), pt(24, 91), pt(38, 103)],
                ['L. shoulder', 'Head', 'R. shoulder'],
                'below'
            ),
            breakMarker(breakIndex(bars, 39, neck, 'above'), 'above'),
        ]
    );
};

const ascendingTriangle = (): GuideDemo => {
    return build(
        47,
        [
            pt(0, 94),
            pt(8, 108),
            pt(14, 99.5),
            pt(20, 108),
            pt(25, 103.5),
            pt(30, 108),
            pt(34, 105.8),
            pt(52, 120),
        ],
        bars => [
            {
                kind: 'level',
                price: 108,
                fromIndex: 8,
                label: 'Resistance',
                role: 'resistance',
            },
            ray(pt(14, 99.5), pt(34, 105.8), 42, 'support', 'Rising support'),
            breakMarker(
                breakIndex(bars, 35, () => 108, 'above'),
                'above'
            ),
        ]
    );
};

const descendingTriangle = (): GuideDemo =>
    build(
        48,
        [
            pt(0, 106),
            pt(8, 92),
            pt(14, 100.5),
            pt(20, 92),
            pt(25, 96.5),
            pt(30, 92),
            pt(34, 94.2),
            pt(52, 80),
        ],
        bars => [
            {
                kind: 'level',
                price: 92,
                fromIndex: 8,
                label: 'Support',
                role: 'support',
            },
            ray(
                pt(14, 100.5),
                pt(34, 94.2),
                42,
                'resistance',
                'Falling resistance'
            ),
            breakMarker(
                breakIndex(bars, 35, () => 92, 'below'),
                'below'
            ),
        ]
    );

const symmetricalTriangle = (): GuideDemo => {
    const upper = lineAt(pt(8, 108), pt(30, 101.5));
    return build(
        49,
        [
            pt(0, 92),
            pt(8, 108),
            pt(14, 94),
            pt(20, 104),
            pt(25, 96.5),
            pt(30, 101.5),
            pt(34, 98.2),
            pt(52, 114),
        ],
        bars => [
            ray(pt(8, 108), pt(30, 101.5), 42, 'resistance', 'Falling highs'),
            ray(pt(14, 94), pt(34, 98.2), 42, 'support', 'Rising lows'),
            breakMarker(breakIndex(bars, 35, upper, 'above'), 'above'),
        ]
    );
};

const ascendingWedge = (): GuideDemo => {
    const lower = lineAt(pt(13, 94), pt(35, 105.5));
    return build(
        50,
        [
            pt(0, 88),
            pt(8, 100),
            pt(13, 94),
            pt(20, 106),
            pt(25, 101),
            pt(31, 109),
            pt(35, 105.5),
            pt(39, 110.5),
            pt(54, 94),
        ],
        bars => [
            ray(pt(8, 100), pt(39, 110.5), 44, 'trend', 'Upper'),
            ray(pt(13, 94), pt(35, 105.5), 44, 'trend', 'Lower'),
            breakMarker(breakIndex(bars, 40, lower, 'below'), 'below'),
        ]
    );
};

const descendingWedge = (): GuideDemo => {
    const upper = lineAt(pt(13, 106), pt(35, 94.5));
    return build(
        51,
        [
            pt(0, 112),
            pt(8, 100),
            pt(13, 106),
            pt(20, 94),
            pt(25, 99),
            pt(31, 91),
            pt(35, 94.5),
            pt(39, 89.5),
            pt(54, 106),
        ],
        bars => [
            ray(pt(13, 106), pt(35, 94.5), 44, 'trend', 'Upper'),
            ray(pt(8, 100), pt(31, 91), 44, 'trend', 'Lower'),
            breakMarker(breakIndex(bars, 40, upper, 'above'), 'above'),
        ]
    );
};

const ascendingChannel = (): GuideDemo => {
    const lower = (i: number) => 91 + 0.5 * i;
    return build(
        52,
        [
            pt(0, 100),
            pt(8, 95),
            pt(14, 108),
            pt(24, 103),
            pt(30, 116),
            pt(40, 111),
            pt(48, 118),
            pt(60, 100),
        ],
        bars => [
            ray(pt(0, 101), pt(52, 127), 54, 'trend', 'Upper'),
            ray(pt(0, 91), pt(52, 117), 54, 'trend', 'Lower'),
            breakMarker(breakIndex(bars, 49, lower, 'below'), 'below'),
        ]
    );
};

const descendingChannel = (): GuideDemo => {
    const upper = (i: number) => 119 - 0.5 * i;
    return build(
        53,
        [
            pt(0, 112),
            pt(6, 116),
            pt(14, 102),
            pt(22, 108),
            pt(30, 94),
            pt(38, 100),
            pt(46, 86),
            pt(62, 112),
        ],
        bars => [
            ray(pt(0, 119), pt(52, 93), 54, 'trend', 'Upper'),
            ray(pt(0, 109), pt(52, 83), 54, 'trend', 'Lower'),
            breakMarker(breakIndex(bars, 47, upper, 'above'), 'above'),
        ]
    );
};

const rectangle = (): GuideDemo =>
    build(
        54,
        [
            pt(0, 100),
            pt(6, 108),
            pt(12, 96),
            pt(18, 108),
            pt(24, 96),
            pt(30, 108),
            pt(36, 96),
            pt(56, 121),
        ],
        bars => [
            {
                kind: 'level',
                price: 108,
                fromIndex: 6,
                label: 'Resistance',
                role: 'resistance',
            },
            {
                kind: 'level',
                price: 96,
                fromIndex: 6,
                label: 'Support',
                role: 'support',
            },
            breakMarker(
                breakIndex(bars, 37, () => 108, 'above'),
                'above'
            ),
        ]
    );

const broadeningFormation = (): GuideDemo =>
    build(
        55,
        [
            pt(0, 100),
            pt(6, 104),
            pt(12, 97),
            pt(18, 109),
            pt(24, 92),
            pt(30, 114),
            pt(36, 87),
            pt(44, 103),
        ],
        () => [
            ray(pt(6, 104), pt(30, 114), 44, 'resistance', 'Higher highs'),
            ray(pt(12, 97), pt(36, 87), 44, 'support', 'Lower lows'),
        ]
    );

const bullFlag = (): GuideDemo => {
    const upper = lineAt(pt(10, 120), pt(28, 114));
    return build(
        56,
        [
            pt(0, 92),
            pt(10, 120),
            pt(15, 112),
            pt(19, 117),
            pt(24, 109),
            pt(28, 114),
            pt(32, 106),
            pt(50, 134),
        ],
        bars => [
            ray(pt(0, 92), pt(10, 120), 10, 'neutral', 'Pole'),
            ray(pt(10, 120), pt(28, 114), 36, 'trend'),
            ray(pt(15, 112), pt(32, 106), 36, 'trend', 'Flag'),
            breakMarker(breakIndex(bars, 33, upper, 'above'), 'above'),
        ]
    );
};

const bearFlag = (): GuideDemo => {
    const lower = lineAt(pt(10, 100), pt(28, 106));
    return build(
        57,
        [
            pt(0, 128),
            pt(10, 100),
            pt(15, 108),
            pt(19, 103),
            pt(24, 111),
            pt(28, 106),
            pt(32, 114),
            pt(50, 86),
        ],
        bars => [
            ray(pt(0, 128), pt(10, 100), 10, 'neutral', 'Pole'),
            ray(pt(10, 100), pt(28, 106), 36, 'trend'),
            ray(pt(15, 108), pt(32, 114), 36, 'trend', 'Flag'),
            breakMarker(breakIndex(bars, 33, lower, 'below'), 'below'),
        ]
    );
};

const pennant = (): GuideDemo => {
    const upper = lineAt(pt(10, 120), pt(24, 115));
    return build(
        58,
        [
            pt(0, 92),
            pt(10, 120),
            pt(14, 111),
            pt(18, 116),
            pt(21, 112.5),
            pt(24, 115),
            pt(26, 113.5),
            pt(40, 134),
        ],
        bars => [
            ray(pt(0, 92), pt(10, 120), 10, 'neutral', 'Pole'),
            ray(pt(10, 120), pt(24, 115), 28, 'trend'),
            ray(pt(14, 111), pt(26, 113.5), 28, 'trend', 'Pennant'),
            breakMarker(breakIndex(bars, 27, upper, 'above'), 'above'),
        ]
    );
};

const highTightFlag = (): GuideDemo =>
    build(
        59,
        [
            pt(0, 60),
            pt(10, 120),
            pt(14, 113),
            pt(18, 119),
            pt(22, 114),
            pt(26, 119.5),
            pt(29, 115),
            pt(44, 138),
        ],
        bars => [
            ray(pt(0, 60), pt(10, 120), 10, 'neutral', 'Pole'),
            {
                kind: 'zone',
                fromIndex: 10,
                toIndex: 29,
                low: 112,
                high: 120.5,
                label: 'Tight flag',
            },
            {
                kind: 'level',
                price: 120,
                fromIndex: 10,
                label: 'Pole top',
                role: 'resistance',
            },
            breakMarker(
                breakIndex(bars, 30, () => 120, 'above'),
                'above'
            ),
        ],
        0.02
    );

const cupAndHandle = (): GuideDemo => {
    const cup = curve(0, 40, 4, i => 90 + 20 * ((i - 20) / 20) ** 2);
    return build(
        60,
        [...cup, pt(47, 103), pt(64, 120)],
        bars => [
            {
                kind: 'level',
                price: 110,
                fromIndex: 0,
                label: 'Rim',
                role: 'resistance',
            },
            {
                kind: 'zone',
                fromIndex: 40,
                toIndex: 47,
                low: 102,
                high: 111,
                label: 'Handle',
            },
            breakMarker(
                breakIndex(bars, 48, () => 110, 'above'),
                'above'
            ),
        ],
        0.014
    );
};

const roundingBottom = (): GuideDemo => {
    const bowl = curve(0, 50, 4, i => 90 + 20 * ((i - 25) / 25) ** 2);
    return build(
        61,
        [...bowl, pt(62, 119)],
        bars => [
            {
                kind: 'level',
                price: 110,
                fromIndex: 0,
                label: 'Left rim',
                role: 'resistance',
            },
            breakMarker(
                breakIndex(bars, 51, () => 110, 'above'),
                'above'
            ),
        ],
        0.014
    );
};

const roundingTop = (): GuideDemo => {
    const dome = curve(0, 50, 4, i => 110 - 20 * ((i - 25) / 25) ** 2);
    return build(
        62,
        [...dome, pt(62, 81)],
        bars => [
            {
                kind: 'level',
                price: 90,
                fromIndex: 0,
                label: 'Left rim',
                role: 'support',
            },
            breakMarker(
                breakIndex(bars, 51, () => 90, 'below'),
                'below'
            ),
        ],
        0.014
    );
};

export const CHART_PATTERN_DEMOS: Record<string, () => GuideDemo> = {
    'ascending-channel': ascendingChannel,
    'ascending-triangle': ascendingTriangle,
    'ascending-wedge': ascendingWedge,
    'bear-flag': bearFlag,
    'broadening-formation': broadeningFormation,
    'bull-flag': bullFlag,
    'cup-and-handle': cupAndHandle,
    'descending-channel': descendingChannel,
    'descending-triangle': descendingTriangle,
    'descending-wedge': descendingWedge,
    'double-bottom': doubleBottom,
    'double-top': doubleTop,
    'head-and-shoulders': headAndShoulders,
    'high-tight-flag': highTightFlag,
    'inverse-head-and-shoulders': inverseHeadAndShoulders,
    pennant,
    rectangle,
    'rounding-bottom': roundingBottom,
    'rounding-top': roundingTop,
    'symmetrical-triangle': symmetricalTriangle,
    'triple-bottom': tripleBottom,
    'triple-top': tripleTop,
};
