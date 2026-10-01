import { describe, expect, it } from 'vitest';
import type { ChartOverlay } from '@y0ngha/siglens-core';
import {
    barTimesOf,
    buildOverlayLineSpecs,
    hasDrawnLevels,
    isOverlayAlignedToBars,
    isOverlayDrawn,
    overlayColorFor,
    overlayItemKey,
} from '../../utils/chartOverlayUtils';

const overlay = (over: Partial<ChartOverlay>): ChartOverlay => ({
    id: 'pattern:double_bottom:1',
    kind: 'pattern',
    skill: 'double_bottom',
    sourceRef: 'double_bottom_0',
    variant: 'primary',
    segments: [
        {
            from: { time: 1, price: 10 },
            to: { time: 3, price: 12 },
            role: 'pattern',
            style: 'solid',
            pane: 'price',
        },
    ],
    levels: [{ price: 11, fromTime: 1, label: 'breakout' }],
    labels: [],
    ...over,
});
const BAR_TIMES = new Set([1, 2, 3, 4, 5]);

describe('overlayItemKey', () => {
    it('trendline uses overlay.id; everything else uses sourceRef', () => {
        expect(
            overlayItemKey(
                overlay({
                    kind: 'trendline',
                    id: 'trendline:abc',
                    sourceRef: 'trendlines',
                })
            )
        ).toBe('trendline:abc');
        expect(
            overlayItemKey(overlay({ kind: 'pattern', sourceRef: 'p1' }))
        ).toBe('p1');
        expect(
            overlayItemKey(overlay({ kind: 'divergence', sourceRef: 'd1' }))
        ).toBe('d1');
    });
});

describe('barTimesOf', () => {
    it('collects each bar time into a Set', () => {
        const bars = [{ time: 1 }, { time: 2 }, { time: 3 }];
        expect(barTimesOf(bars)).toEqual(new Set([1, 2, 3]));
    });
});

describe('isOverlayAlignedToBars', () => {
    it('true only when every anchor time is a loaded bar', () => {
        expect(isOverlayAlignedToBars(overlay({}), BAR_TIMES)).toBe(true);
        expect(
            isOverlayAlignedToBars(
                overlay({ levels: [{ price: 1, fromTime: 99, label: '' }] }),
                BAR_TIMES
            )
        ).toBe(false);
    });
});

describe('buildOverlayLineSpecs', () => {
    const base = {
        hiddenKeys: new Set<string>(),
        highlightedKey: null,
        lastBarTime: 5,
        rsiPaneIndex: 2,
        colorFor: () => '#000',
        extendLevelsRight: false,
    };

    it('segment → 2-point price series; level → fromTime to last bar', () => {
        const specs = buildOverlayLineSpecs([overlay({})], {
            ...base,
            barTimes: BAR_TIMES,
        });
        expect(specs.map(s => s.points)).toEqual([
            [
                { time: 1, value: 10 },
                { time: 3, value: 12 },
            ],
            [
                { time: 1, value: 11 },
                { time: 5, value: 11 },
            ],
        ]);
        expect(specs.every(s => s.paneIndex === 0)).toBe(true);
    });

    it('extendLevelsRight marks level specs only', () => {
        const specsFor = (extendLevelsRight: boolean) =>
            buildOverlayLineSpecs([overlay({})], {
                ...base,
                barTimes: BAR_TIMES,
                extendLevelsRight,
            }).map(s => s.extendRight);
        expect(specsFor(true)).toEqual([false, true]);
        expect(specsFor(false)).toEqual([false, false]);
    });

    it('hidden key, misaligned overlay, and zero-length segment produce nothing', () => {
        expect(
            buildOverlayLineSpecs([overlay({})], {
                ...base,
                barTimes: BAR_TIMES,
                hiddenKeys: new Set(['double_bottom_0']),
            })
        ).toEqual([]);
        expect(
            buildOverlayLineSpecs(
                [overlay({ levels: [{ price: 1, fromTime: 99, label: '' }] })],
                { ...base, barTimes: BAR_TIMES }
            )
        ).toEqual([]);
        const flat = overlay({
            segments: [
                {
                    from: { time: 2, price: 1 },
                    to: { time: 2, price: 2 },
                    role: 'x',
                    style: 'solid',
                    pane: 'price',
                },
            ],
            levels: [],
        });
        expect(
            buildOverlayLineSpecs([flat], { ...base, barTimes: BAR_TIMES })
        ).toEqual([]);
    });

    it('rsi segments go to the rsi pane, or are dropped when that pane is off', () => {
        const div = overlay({
            kind: 'divergence',
            levels: [],
            segments: [
                {
                    from: { time: 1, price: 10 },
                    to: { time: 4, price: 9 },
                    role: 'price',
                    style: 'solid',
                    pane: 'price',
                },
                {
                    from: { time: 1, price: 30 },
                    to: { time: 4, price: 40 },
                    role: 'rsi',
                    style: 'solid',
                    pane: 'rsi',
                },
            ],
        });
        expect(
            buildOverlayLineSpecs([div], { ...base, barTimes: BAR_TIMES }).map(
                s => s.paneIndex
            )
        ).toEqual([0, 2]);
        expect(
            buildOverlayLineSpecs([div], {
                ...base,
                barTimes: BAR_TIMES,
                rsiPaneIndex: null,
            })
        ).toHaveLength(1);
    });

    it('highlight of a visible key widens that overlay and dims the rest; alternate is faded', () => {
        // a(기본 overlay)는 segment 1 + level 1 = spec 2개, b는 level을 비워
        // segment 1개뿐이다 — a의 강조 spec은 앞의 2개, b는 마지막 1개다.
        const a = overlay({});
        const b = overlay({ id: 'x', sourceRef: 'other', levels: [] });
        const specs = buildOverlayLineSpecs([a, b], {
            ...base,
            barTimes: BAR_TIMES,
            highlightedKey: 'double_bottom_0',
        });
        expect(specs).toHaveLength(3);
        expect(specs[0].lineWidthMult).toBe(2);
        expect(specs[1].lineWidthMult).toBe(2);
        expect(specs.at(-1)!.opacity).toBe(0.3);
        const alt = buildOverlayLineSpecs([overlay({ variant: 'alternate' })], {
            ...base,
            barTimes: BAR_TIMES,
        });
        expect(alt[0].opacity).toBe(0.5);
    });

    it('highlight of a hidden key applies no dimming, and the hidden overlay stays absent', () => {
        // b(other)의 key는 hiddenKeys에 있고 동시에 highlightedKey로도 지정된다 —
        // 꺼진 작도는 강조로도 켜지지 않고, 켜져 있는 a도 흐려지지 않아야 한다
        // (highlightedKey가 켜진 항목일 때만 강조가 걸린다는 옵션 계약).
        const a = overlay({});
        const b = overlay({ id: 'x', sourceRef: 'other', levels: [] });
        const specs = buildOverlayLineSpecs([a, b], {
            ...base,
            barTimes: BAR_TIMES,
            hiddenKeys: new Set(['other']),
            highlightedKey: 'other',
        });
        // b가 빠졌으니 a의 spec 2개만 남고, 아무것도 강조·dim되지 않는다(opacity 1, lineWidthMult 1).
        expect(specs).toHaveLength(2);
        expect(specs.every(s => s.lineWidthMult === 1)).toBe(true);
        expect(specs.every(s => s.opacity === 1)).toBe(true);
    });

    it('a level whose fromTime is not before lastBarTime is skipped (though aligned to bars)', () => {
        // fromTime=5 is a loaded bar (aligned) but equals lastBarTime(5), so the
        // level-skip guard (fromTime >= lastBarTime) drops it — distinct from
        // isOverlayAlignedToBars, which only checks bar membership.
        const atLastBar = overlay({
            segments: [],
            levels: [{ price: 11, fromTime: 5, label: 'breakout' }],
        });
        expect(
            buildOverlayLineSpecs([atLastBar], { ...base, barTimes: BAR_TIMES })
        ).toEqual([]);
    });

    it('levelLabelFor rewrites the level title when provided; falls back to the raw label otherwise', () => {
        // segment spec(index 0) carries no title; the level spec is index 1.
        const specsWithMapper = buildOverlayLineSpecs([overlay({})], {
            ...base,
            barTimes: BAR_TIMES,
            levelLabelFor: label =>
                label === 'breakout' ? '돌파 기준' : label,
        });
        expect(specsWithMapper[1].title).toBe('돌파 기준');

        const specsWithoutMapper = buildOverlayLineSpecs([overlay({})], {
            ...base,
            barTimes: BAR_TIMES,
        });
        expect(specsWithoutMapper[1].title).toBe('breakout');
    });

    it('labels ride on the first spec of their overlay as markers, carrying label price for marker placement', () => {
        const withLabels = overlay({
            labels: [
                { at: { time: 3, price: 12 }, text: 'H', position: 'above' },
            ],
        });
        const [first] = buildOverlayLineSpecs([withLabels], {
            ...base,
            barTimes: BAR_TIMES,
        });
        expect(first.markers).toEqual([
            { time: 3, position: 'aboveBar', text: 'H', price: 12 },
        ]);
    });
});

describe('buildOverlayLineSpecs — label host pane', () => {
    it('attaches labels to the price-pane spec even when an rsi segment comes first', () => {
        const div = overlay({
            kind: 'divergence',
            levels: [],
            segments: [
                {
                    from: { time: 1, price: 30 },
                    to: { time: 4, price: 40 },
                    role: 'rsi',
                    style: 'solid',
                    pane: 'rsi',
                },
                {
                    from: { time: 1, price: 10 },
                    to: { time: 4, price: 9 },
                    role: 'price',
                    style: 'solid',
                    pane: 'price',
                },
            ],
            labels: [
                { at: { time: 4, price: 9 }, text: 'D', position: 'below' },
            ],
        });
        const specs = buildOverlayLineSpecs([div], {
            hiddenKeys: new Set(),
            highlightedKey: null,
            barTimes: BAR_TIMES,
            lastBarTime: 5,
            rsiPaneIndex: 2,
            colorFor: () => '#000000',
            extendLevelsRight: false,
        });
        expect(specs.map(sp => [sp.paneIndex, sp.markers.length])).toEqual([
            [2, 0],
            [0, 1],
        ]);
    });
});

describe('isOverlayDrawn', () => {
    it('needs both alignment to the loaded bars and a drawable line', () => {
        expect(isOverlayDrawn(overlay({}), BAR_TIMES, 5)).toBe(true);
        expect(
            isOverlayDrawn(
                overlay({ levels: [{ price: 1, fromTime: 99, label: '' }] }),
                BAR_TIMES,
                5
            )
        ).toBe(false);
        expect(
            isOverlayDrawn(
                overlay({
                    segments: [],
                    levels: [{ price: 1, fromTime: 5, label: '' }],
                }),
                BAR_TIMES,
                5
            )
        ).toBe(false);
    });

    it('does not draw an overlay whose segments and levels all get filtered out (nothing drawable)', () => {
        // Zero-length segment + a level starting at the last bar: aligned, but
        // buildOverlayLineSpecs would draw nothing.
        const empty = overlay({
            id: 'empty',
            segments: [
                {
                    from: { time: 2, price: 1 },
                    to: { time: 2, price: 2 },
                    role: 'x',
                    style: 'solid',
                    pane: 'price',
                },
            ],
            levels: [{ price: 1, fromTime: 5, label: '' }],
            labels: [
                { at: { time: 2, price: 1 }, text: 'H', position: 'above' },
            ],
        });
        expect(isOverlayDrawn(empty, BAR_TIMES, 5)).toBe(false);
        expect(
            buildOverlayLineSpecs([empty], {
                hiddenKeys: new Set(),
                highlightedKey: null,
                barTimes: BAR_TIMES,
                lastBarTime: 5,
                rsiPaneIndex: null,
                colorFor: () => '#000000',
                extendLevelsRight: false,
            })
        ).toEqual([]);
    });
});

describe('hasDrawnLevels', () => {
    const opts = {
        hiddenKeys: new Set<string>(),
        barTimes: BAR_TIMES,
        lastBarTime: 5,
    };

    it('켜진 채 그려지는 작도에 레벨이 있으면 true', () => {
        expect(hasDrawnLevels([overlay({})], opts)).toBe(true);
    });

    it('레벨 작도가 전부 꺼졌거나, 레벨이 없거나, 봉에 안 맞으면 false', () => {
        expect(
            hasDrawnLevels([overlay({})], {
                ...opts,
                hiddenKeys: new Set(['double_bottom_0']),
            })
        ).toBe(false);
        expect(hasDrawnLevels([overlay({ levels: [] })], opts)).toBe(false);
        expect(
            hasDrawnLevels(
                [overlay({ levels: [{ price: 1, fromTime: 99, label: '' }] })],
                opts
            )
        ).toBe(false);
    });
});

describe('overlayColorFor', () => {
    const fallback = {
        pattern: () => '#pattern',
        support: () => '#support',
        resistance: () => '#resistance',
        divergence: () => '#divergence',
        fibonacci: () => '#fibonacci',
        elliott: () => '#elliott',
    };

    it('pattern: uses the skill color when patternColors has an entry for sourceRef', () => {
        const p = overlay({ kind: 'pattern', sourceRef: 'double_bottom_0' });
        expect(
            overlayColorFor(
                p,
                'pattern',
                { double_bottom_0: '#custom' },
                fallback
            )
        ).toBe('#custom');
    });

    it('pattern: falls back to fallback.pattern() when sourceRef has no entry', () => {
        const p = overlay({ kind: 'pattern', sourceRef: 'missing' });
        expect(overlayColorFor(p, 'pattern', {}, fallback)).toBe('#pattern');
    });

    it('trendline: role resistance uses fallback.resistance(), anything else uses fallback.support()', () => {
        const t = overlay({ kind: 'trendline' });
        expect(overlayColorFor(t, 'resistance', {}, fallback)).toBe(
            '#resistance'
        );
        expect(overlayColorFor(t, 'support', {}, fallback)).toBe('#support');
        expect(overlayColorFor(t, 'level', {}, fallback)).toBe('#support');
    });

    it('other kinds (divergence/fibonacci/elliott) use fallback[kind]()', () => {
        expect(
            overlayColorFor(
                overlay({ kind: 'divergence' }),
                'price',
                {},
                fallback
            )
        ).toBe('#divergence');
        expect(
            overlayColorFor(
                overlay({ kind: 'fibonacci' }),
                'level',
                {},
                fallback
            )
        ).toBe('#fibonacci');
        expect(
            overlayColorFor(overlay({ kind: 'elliott' }), 'wave', {}, fallback)
        ).toBe('#elliott');
    });
});
