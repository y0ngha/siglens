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
    isOverlayDrawable,
    labelBoxAt,
    labelTextX,
    layoutOverlayLabels,
    MARKER_ARROW_REACH_RATIO,
    MARKER_BAR_GAP,
    markerGeometry,
    overlayKey,
    overlayLayers,
    profileRowHeight,
} from '@/views/guide/lib/demoChartLayout';

/** 봉 범위가 [100, 110]인 평평한 봉열. */
const flatBars = (count: number): DemoBar[] =>
    Array.from({ length: count }, (_, i) => ({
        time: i,
        open: 102,
        high: 110,
        low: 100,
        close: 108,
    }));

const demoWith = (overlays: DemoOverlay[], count = 10): GuideDemo => ({
    bars: flatBars(count),
    overlays,
});

describe('isFiniteValue', () => {
    it('accepts finite numbers only', () => {
        expect(
            [0, -3.5, null, undefined, Number.NaN, Infinity].map(isFiniteValue)
        ).toEqual([true, true, false, false, false, false]);
    });
});

describe('demoPriceDomain', () => {
    it('pads the bar range by 7% on each side', () => {
        expect(demoPriceDomain(demoWith([]))).toEqual([99.3, 110.7]);
    });

    it('widens the range for a level outside the bars', () => {
        const [, max] = demoPriceDomain(
            demoWith([{ kind: 'level', price: 130, label: 'R' }])
        );
        expect(max).toBeCloseTo(130 + 30 * 0.07);
    });

    it('ignores a far series that is not part of the domain', () => {
        expect(
            demoPriceDomain(
                demoWith([
                    { kind: 'series', values: [200, null], label: 'FAR' },
                ])
            )
        ).toEqual([99.3, 110.7]);
    });

    it('judges "far" against the range widened by earlier overlays', () => {
        // 봉 범위 10의 35% = 3.5. 레벨 130이 먼저 넓히면 133은 더 이상 멀지 않다.
        const series: DemoOverlay = {
            kind: 'series',
            values: [133],
            label: 'S',
        };
        const level: DemoOverlay = { kind: 'level', price: 130, label: 'R' };
        expect(demoPriceDomain(demoWith([level, series]))[1]).toBeCloseTo(
            133 + 33 * 0.07
        );
        expect(demoPriceDomain(demoWith([series, level]))[1]).toBeCloseTo(
            130 + 30 * 0.07
        );
    });

    it('leaves room above a marker on the top of a bar', () => {
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
        // 고가 110 + 봉 범위 10 × 12%
        expect(max).toBeCloseTo(111.2 + 11.2 * 0.07);
    });
});

describe('demoChartFrame', () => {
    it('ends below the price area when there are no panes', () => {
        const frame = demoChartFrame(demoWith([]));
        expect(frame.panes).toEqual([]);
        expect(frame.totalHeight).toBe(
            DEMO_CHART_MARGIN_TOP + DEMO_PRICE_HEIGHT + DEMO_CHART_MARGIN_BOTTOM
        );
    });

    it('stacks panes under the price area with a gap', () => {
        const frame = demoChartFrame({
            bars: flatBars(4),
            panes: [{ label: 'A' }, { label: 'B', height: 50 }],
        });
        const priceBottom = DEMO_CHART_MARGIN_TOP + DEMO_PRICE_HEIGHT;
        expect(frame.panes.map(({ top, height }) => ({ top, height }))).toEqual(
            [
                { top: priceBottom + 8, height: 78 },
                { top: priceBottom + 8 + 78 + 8, height: 50 },
            ]
        );
        expect(frame.totalHeight).toBe(
            priceBottom + 8 + 78 + 8 + 50 + DEMO_CHART_MARGIN_BOTTOM
        );
    });

    it('centres each bar in its slot', () => {
        const frame = demoChartFrame(demoWith([], 4));
        expect(frame.pitch).toBe(frame.plotWidth / 4);
        expect(frame.xOf(0)).toBe(frame.plot.left + frame.pitch / 2);
        expect(frame.plot.right).toBeLessThan(DEMO_CHART_WIDTH);
    });
});

describe('labelBoxAt / labelTextX', () => {
    const plot = { top: 0, bottom: 100, left: 10, right: 200 };

    it('places the box by its anchor', () => {
        const width = estimateLabelWidth('AB', DEMO_CHART_FONT);
        expect(labelBoxAt('AB', 100, 50, 'start', plot).x).toBe(100);
        expect(labelBoxAt('AB', 100, 50, 'end', plot).x).toBe(100 - width);
        expect(labelBoxAt('AB', 100, 50, 'middle', plot).x).toBe(
            100 - width / 2
        );
    });

    it('keeps the box inside the plot horizontally', () => {
        const width = estimateLabelWidth('AB', DEMO_CHART_FONT);
        expect(labelBoxAt('AB', 0, 50, 'start', plot).x).toBe(10);
        expect(labelBoxAt('AB', 400, 50, 'start', plot).x).toBe(200 - width);
    });

    it('centres the box vertically on y', () => {
        const box = labelBoxAt('AB', 100, 50, 'start', plot);
        expect(box.height).toBe(DEMO_CHART_FONT + 3);
        expect(box.y + box.height / 2).toBe(50);
    });

    it('insets the text anchor from the box edges', () => {
        const box = { x: 10, y: 0, width: 40, height: 15 };
        expect(labelTextX(box, 'start')).toBe(12);
        expect(labelTextX(box, 'middle')).toBe(30);
        expect(labelTextX(box, 'end')).toBe(48);
    });
});

describe('bandEdges', () => {
    it('keeps only slots where both edges are finite', () => {
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
});

describe('isOverlayDrawable', () => {
    const band = (upper: (number | null)[], lower: (number | null)[]) =>
        ({ kind: 'band', upper, lower, label: '' }) satisfies DemoOverlay;
    const marker = (i: number) =>
        ({
            kind: 'marker',
            i,
            position: 'above',
            label: 'M',
            tone: 'bull',
        }) satisfies DemoOverlay;

    it('draws a band with two or more valid slots', () => {
        expect(isOverlayDrawable(band([5, null, 7], [1, 2, 3]), [])).toBe(true);
    });

    it('skips a band with fewer than two valid slots', () => {
        expect(isOverlayDrawable(band([5, null, 7], [1, 2, null]), [])).toBe(
            false
        );
    });

    it('draws a marker that points at an existing bar', () => {
        expect(isOverlayDrawable(marker(9), flatBars(10))).toBe(true);
    });

    it('skips a marker that points past the last bar', () => {
        expect(isOverlayDrawable(marker(10), flatBars(10))).toBe(false);
    });

    it('always draws the other overlay kinds', () => {
        expect(
            isOverlayDrawable({ kind: 'level', price: 1, label: 'L' }, [])
        ).toBe(true);
    });
});

describe('markerGeometry', () => {
    const frame = demoChartFrame(demoWith([]));

    it('returns null for a marker past the last bar', () => {
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

    it('points down at the high from above, and up at the low from below', () => {
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
        expect(above).toEqual({
            x: frame.xOf(2),
            tipY: frame.yOf(110) - MARKER_BAR_GAP,
            baseY:
                frame.yOf(110) -
                MARKER_BAR_GAP -
                DEMO_MARKER_ARROW * MARKER_ARROW_REACH_RATIO,
            above: true,
        });
        expect(below?.tipY).toBe(frame.yOf(100) + MARKER_BAR_GAP);
        expect(below?.baseY).toBe(
            frame.yOf(100) +
                MARKER_BAR_GAP +
                DEMO_MARKER_ARROW * MARKER_ARROW_REACH_RATIO
        );
    });
});

describe('profileRowHeight', () => {
    const yOf = (value: number): number => -value * 2;

    it('uses the smallest price gap minus one, at least 2', () => {
        expect(
            profileRowHeight([{ price: 10 }, { price: 16 }, { price: 13 }], yOf)
        ).toBe(5);
        expect(profileRowHeight([{ price: 10 }, { price: 10.2 }], yOf)).toBe(2);
    });

    it('falls back to 4 for a single row', () => {
        expect(profileRowHeight([{ price: 10 }], yOf)).toBe(4);
    });
});

describe('layoutOverlayLabels', () => {
    const level = (price: number, label: string): DemoOverlay => ({
        kind: 'level',
        price,
        label,
    });

    it('keys labels by overlay kind and position and keeps overlay order', () => {
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

    it('moves a later label off an earlier one at the same spot', () => {
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

    it('colours each label by its overlay', () => {
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

    it('skips labels for overlays that cannot draw or have no text', () => {
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

    it('labels a band at its last finite upper value', () => {
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

    it('puts markers above the bars and everything else below, keeping order', () => {
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

    it('keys each overlay by its position in the original list', () => {
        const { belowBars, aboveBars } = overlayLayers([
            marker(3),
            zone,
            level,
        ]);
        expect(belowBars.map(({ key }) => key)).toEqual(['zone-1', 'level-2']);
        expect(aboveBars.map(({ key }) => key)).toEqual(['marker-0']);
    });
});
