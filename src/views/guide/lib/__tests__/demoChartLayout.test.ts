import { describe, expect, it } from 'vitest';
import type {
    DemoBar,
    DemoOverlay,
    GuideDemo,
} from '@/views/guide/demos/types';
import { estimateLabelWidth } from '@/views/guide/lib/chartLayout';
import {
    bandEdges,
    DEMO_CHART_FONT,
    DEMO_CHART_MARGIN_BOTTOM,
    DEMO_CHART_MARGIN_TOP,
    DEMO_CHART_WIDTH,
    DEMO_MARKER_ARROW,
    DEMO_PRICE_HEIGHT,
    demoChartFrame,
    demoPriceDomain,
    isFiniteValue,
    LABEL_BOX_PAD_Y,
    LABEL_INSET,
    labelBoxAt,
    labelTextX,
    layoutOverlayLabels,
    MARKER_ARROW_REACH_RATIO,
    MARKER_BAR_GAP,
    MARKER_ROOM,
    markerGeometry,
    overlayKey,
    overlayLayers,
    PANE_GAP,
    PANE_HEIGHT,
    PRICE_PAD,
    profileRowHeight,
} from '@/views/guide/lib/demoChartLayout';

const BAR_LOW = 100;
const BAR_HIGH = 110;
const BAR_SPAN = BAR_HIGH - BAR_LOW;

/** 봉 범위가 [BAR_LOW, BAR_HIGH]인 평평한 봉열. */
const flatBars = (count: number): DemoBar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: i,
        open: 102,
        high: BAR_HIGH,
        low: BAR_LOW,
        close: 108,
    }));

const demoWith = (overlays: DemoOverlay[], count = 10): GuideDemo => ({
    bars: flatBars(count),
    overlays,
});

/** 오버레이가 넓히지 않았을 때의 가격 축 범위 — 봉 범위를 위아래로 `PRICE_PAD`만큼 띄운다. */
const BAR_DOMAIN = [
    BAR_LOW - BAR_SPAN * PRICE_PAD,
    BAR_HIGH + BAR_SPAN * PRICE_PAD,
];

describe('isFiniteValue', () => {
    it('유한한 숫자만 받는다', () => {
        expect(
            [0, -3.5, null, undefined, Number.NaN, Infinity].map(isFiniteValue)
        ).toEqual([true, true, false, false, false, false]);
    });
});

describe('demoPriceDomain', () => {
    it('봉 범위를 위아래로 PRICE_PAD만큼 띄운다', () => {
        expect(demoPriceDomain(demoWith([]))).toEqual(BAR_DOMAIN);
    });

    it('봉 밖의 수평선까지 범위를 넓힌다', () => {
        const [, max] = demoPriceDomain(
            demoWith([{ kind: 'level', price: 130, label: 'R' }])
        );
        expect(max).toBeCloseTo(130 + (130 - BAR_LOW) * PRICE_PAD);
    });

    it('범위에 넣지 않는 먼 시리즈는 무시한다', () => {
        expect(
            demoPriceDomain(
                demoWith([
                    { kind: 'series', values: [200, null], label: 'FAR' },
                ])
            )
        ).toEqual(BAR_DOMAIN);
    });

    it('"먼" 값은 앞선 오버레이가 넓힌 범위를 기준으로 판정한다', () => {
        // 봉 범위 10의 35% = 3.5. 레벨 130이 먼저 넓히면 133은 더 이상 멀지 않다.
        const series: DemoOverlay = {
            kind: 'series',
            values: [133],
            label: 'S',
        };
        const level: DemoOverlay = { kind: 'level', price: 130, label: 'R' };
        expect(demoPriceDomain(demoWith([level, series]))[1]).toBeCloseTo(
            133 + (133 - BAR_LOW) * PRICE_PAD
        );
        expect(demoPriceDomain(demoWith([series, level]))[1]).toBeCloseTo(
            130 + (130 - BAR_LOW) * PRICE_PAD
        );
    });

    it('봉 위 표식이 들어갈 자리를 남긴다', () => {
        const [, max] = demoPriceDomain(
            demoWith([
                {
                    kind: 'marker',
                    i: 0,
                    position: 'above',
                    label: 'M',
                    tone: 'bull',
                },
            ])
        );
        // 고가 + 봉 범위 × MARKER_ROOM까지 넓힌 뒤 PRICE_PAD를 띄운다.
        const markerTop = BAR_HIGH + BAR_SPAN * MARKER_ROOM;
        expect(max).toBeCloseTo(markerTop + (markerTop - BAR_LOW) * PRICE_PAD);
    });
});

describe('demoChartFrame', () => {
    it('패널이 없으면 가격 영역 아래에서 끝난다', () => {
        const frame = demoChartFrame(demoWith([]));
        expect(frame.panes).toEqual([]);
        expect(frame.totalHeight).toBe(
            DEMO_CHART_MARGIN_TOP + DEMO_PRICE_HEIGHT + DEMO_CHART_MARGIN_BOTTOM
        );
    });

    it('패널을 가격 영역 아래에 간격을 두고 쌓는다', () => {
        const frame = demoChartFrame({
            bars: flatBars(4),
            panes: [{ label: 'A' }, { label: 'B', height: 50 }],
        });
        const priceBottom = DEMO_CHART_MARGIN_TOP + DEMO_PRICE_HEIGHT;
        expect(frame.panes.map(({ top, height }) => ({ top, height }))).toEqual(
            [
                { top: priceBottom + PANE_GAP, height: PANE_HEIGHT },
                {
                    top: priceBottom + PANE_GAP + PANE_HEIGHT + PANE_GAP,
                    height: 50,
                },
            ]
        );
        expect(frame.totalHeight).toBe(
            priceBottom +
                PANE_GAP +
                PANE_HEIGHT +
                PANE_GAP +
                50 +
                DEMO_CHART_MARGIN_BOTTOM
        );
    });

    it('봉을 칸 가운데에 놓는다', () => {
        const frame = demoChartFrame(demoWith([], 4));
        expect(frame.pitch).toBe(frame.plotWidth / 4);
        expect(frame.xOf(0)).toBe(frame.plot.left + frame.pitch / 2);
        expect(frame.plot.right).toBeLessThan(DEMO_CHART_WIDTH);
    });
});

describe('labelBoxAt / labelTextX', () => {
    const plot = { top: 0, bottom: 100, left: 10, right: 200 };

    const width = estimateLabelWidth('AB', DEMO_CHART_FONT);

    it.each([
        ['start', 100],
        ['middle', 100 - width / 2],
        ['end', 100 - width],
    ] as const)(
        '%s 기준점이면 박스 왼쪽 끝을 그에 맞춰 놓는다',
        (anchor, left) => {
            expect(labelBoxAt('AB', 100, 50, anchor, plot).x).toBe(left);
        }
    );

    it('박스를 가격 영역 좌우 안에 둔다', () => {
        const width = estimateLabelWidth('AB', DEMO_CHART_FONT);
        expect(labelBoxAt('AB', 0, 50, 'start', plot).x).toBe(10);
        expect(labelBoxAt('AB', 400, 50, 'start', plot).x).toBe(200 - width);
    });

    it('박스를 y에 세로 가운데로 맞춘다', () => {
        const box = labelBoxAt('AB', 100, 50, 'start', plot);
        expect(box.height).toBe(DEMO_CHART_FONT + LABEL_BOX_PAD_Y);
        expect(box.y + box.height / 2).toBe(50);
    });

    it('글자 기준점을 박스 가장자리에서 LABEL_INSET만큼 들인다', () => {
        const box = { x: 10, y: 0, width: 40, height: 15 };
        expect(labelTextX(box, 'start')).toBe(10 + LABEL_INSET);
        expect(labelTextX(box, 'middle')).toBe(30);
        expect(labelTextX(box, 'end')).toBe(50 - LABEL_INSET);
    });
});

describe('bandEdges', () => {
    it('위·아래 값이 둘 다 유한한 칸만 남긴다', () => {
        expect(
            bandEdges({
                kind: 'band',
                upper: [5, null, 7, 8],
                lower: [1, 2, null, 4],
                label: '',
            })
        ).toEqual([
            { i: 0, upper: 5, lower: 1 },
            { i: 3, upper: 8, lower: 4 },
        ]);
    });

    it('유효 칸이 둘 미만이면 띠를 그리지 않도록 null이다', () => {
        expect(
            bandEdges({
                kind: 'band',
                upper: [5, null, 7],
                lower: [1, 2, null],
                label: '',
            })
        ).toBeNull();
    });
});

describe('markerGeometry', () => {
    const frame = demoChartFrame(demoWith([]));

    it('마지막 봉 너머를 가리키는 표식은 null이다', () => {
        expect(
            markerGeometry(
                {
                    kind: 'marker',
                    i: 99,
                    position: 'above',
                    label: 'M',
                    tone: 'bull',
                },
                flatBars(10),
                frame
            )
        ).toBeNull();
    });

    it('위 표식은 고가 위에서 아래를 가리킨다', () => {
        const above = markerGeometry(
            {
                kind: 'marker',
                i: 2,
                position: 'above',
                label: 'M',
                tone: 'bull',
            },
            flatBars(10),
            frame
        );
        expect(above).toEqual({
            x: frame.xOf(2),
            tipY: frame.yOf(BAR_HIGH) - MARKER_BAR_GAP,
            baseY:
                frame.yOf(BAR_HIGH) -
                MARKER_BAR_GAP -
                DEMO_MARKER_ARROW * MARKER_ARROW_REACH_RATIO,
            above: true,
        });
    });

    it('아래 표식은 저가 아래에서 위를 가리킨다', () => {
        const below = markerGeometry(
            {
                kind: 'marker',
                i: 2,
                position: 'below',
                label: 'M',
                tone: 'bear',
            },
            flatBars(10),
            frame
        );
        expect(below?.tipY).toBe(frame.yOf(BAR_LOW) + MARKER_BAR_GAP);
        expect(below?.baseY).toBe(
            frame.yOf(BAR_LOW) +
                MARKER_BAR_GAP +
                DEMO_MARKER_ARROW * MARKER_ARROW_REACH_RATIO
        );
    });
});

describe('profileRowHeight', () => {
    const yOf = (value: number): number => -value * 2;

    it('가장 가까운 두 가격 간격(화면 좌표)에서 1을 뺀다', () => {
        expect(
            profileRowHeight([{ price: 10 }, { price: 16 }, { price: 13 }], yOf)
        ).toBe(5);
    });

    it('간격이 좁아도 높이는 2 아래로 내려가지 않는다', () => {
        expect(profileRowHeight([{ price: 10 }, { price: 10.2 }], yOf)).toBe(2);
    });

    it('한 줄뿐이면 4로 돌아간다', () => {
        expect(profileRowHeight([{ price: 10 }], yOf)).toBe(4);
    });
});

describe('layoutOverlayLabels', () => {
    const level = (price: number, label: string): DemoOverlay => ({
        kind: 'level',
        price,
        label,
    });

    it('라벨 키는 오버레이 종류+위치이고 오버레이 순서를 지킨다', () => {
        const demo = demoWith([
            { kind: 'profile', rows: [{ price: 105, volume: 1 }] },
            level(108, 'R1'),
            level(102, 'S1'),
        ]);
        const labels = layoutOverlayLabels(demo, demoChartFrame(demo));
        expect(labels.map(({ key, text }) => ({ key, text }))).toEqual([
            { key: overlayKey(level(108, 'R1'), 1), text: 'R1' },
            { key: overlayKey(level(102, 'S1'), 2), text: 'S1' },
        ]);
        expect(labels[0].key).toBe('level-1');
    });

    it('같은 자리의 뒤 라벨을 앞 라벨에서 비켜 놓는다', () => {
        // 봉 위쪽 빈 자리라 첫 라벨은 제자리에 앉고, 둘째만 비켜 간다.
        const demo = demoWith([level(130, 'AAA'), level(130, 'BBB')]);
        const [first, second] = layoutOverlayLabels(demo, demoChartFrame(demo));
        const overlap =
            first.box.x < second.box.x + second.box.width &&
            second.box.x < first.box.x + first.box.width &&
            first.box.y < second.box.y + second.box.height &&
            second.box.y < first.box.y + first.box.height;
        expect(overlap).toBe(false);
    });

    it('라벨마다 자기 오버레이의 색 근거를 쓴다', () => {
        const demo = demoWith([
            {
                kind: 'zone',
                fromIndex: 1,
                toIndex: 2,
                low: 101,
                high: 104,
                label: 'Z',
            },
            { kind: 'level', price: 103, label: 'L', role: 'support' },
            {
                kind: 'line',
                from: { i: 0, price: 101 },
                to: { i: 5, price: 109 },
                role: 'trend',
                label: 'T',
            },
            { kind: 'series', values: [104, 105], label: 'S', tone: 'b' },
            {
                kind: 'marker',
                i: 3,
                position: 'below',
                label: 'M',
                tone: 'bear',
            },
        ]);
        expect(
            layoutOverlayLabels(demo, demoChartFrame(demo)).map(l => l.colour)
        ).toEqual([
            { palette: 'zone' },
            { palette: 'role', role: 'support' },
            { palette: 'role', role: 'trend' },
            { palette: 'series', tone: 'b' },
            { palette: 'bar', tone: 'bear' },
        ]);
    });

    it('그릴 수 없거나 글자가 없는 오버레이는 라벨을 내지 않는다', () => {
        const demo = demoWith([
            {
                kind: 'band',
                upper: [106, null],
                lower: [101, null],
                label: 'ONE-SLOT',
            },
            { kind: 'band', upper: [106, 107], lower: [101, 102], label: '' },
            { kind: 'zone', fromIndex: 0, toIndex: 1, low: 101, high: 102 },
            {
                kind: 'line',
                from: { i: 0, price: 101 },
                to: { i: 1, price: 102 },
                role: 'trend',
            },
            { kind: 'series', values: [104], label: '' },
            { kind: 'series', values: [null, null], label: 'EMPTY' },
            {
                kind: 'marker',
                i: 50,
                position: 'above',
                label: 'GONE',
                tone: 'bull',
            },
        ]);
        expect(layoutOverlayLabels(demo, demoChartFrame(demo))).toEqual([]);
    });

    it('띠 라벨은 마지막 유한한 위 값에 붙는다', () => {
        const demo = demoWith([
            {
                kind: 'band',
                upper: [106, 107, null],
                lower: [101, 102, 103],
                label: 'BB',
            },
        ]);
        const frame = demoChartFrame(demo);
        const [label] = layoutOverlayLabels(demo, frame);
        expect(label.anchor).toBe('end');
        expect(label.box.x + label.box.width).toBeLessThanOrEqual(frame.xOf(1));
    });
});

describe('overlayLayers', () => {
    const marker = (i: number): DemoOverlay => ({
        kind: 'marker',
        i,
        position: 'above',
        label: 'M',
        tone: 'bull',
    });
    const zone: DemoOverlay = {
        kind: 'zone',
        fromIndex: 0,
        toIndex: 1,
        low: 100,
        high: 101,
    };
    const level: DemoOverlay = { kind: 'level', price: 105, label: 'L' };

    it('표식은 봉 위 층, 나머지는 봉 아래 층에 두고 순서를 지킨다', () => {
        const { belowBars, aboveBars } = overlayLayers([
            marker(3),
            zone,
            marker(1),
            level,
        ]);
        expect(belowBars.map(({ overlay }) => overlay)).toEqual([zone, level]);
        expect(aboveBars.map(({ overlay }) => overlay)).toEqual([
            marker(3),
            marker(1),
        ]);
    });

    it('키는 원래 목록에서의 위치로 매긴다', () => {
        const { belowBars, aboveBars } = overlayLayers([
            marker(3),
            zone,
            level,
        ]);
        expect(belowBars.map(({ key }) => key)).toEqual(['zone-1', 'level-2']);
        expect(aboveBars.map(({ key }) => key)).toEqual(['marker-0']);
    });
});
