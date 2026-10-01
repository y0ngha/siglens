import { describe, expect, it } from 'vitest';
import type { ChartOverlay } from '@y0ngha/siglens-core';
import {
    ACTION_PRICES_ITEM_KEY,
    buildOverlayMenuItems,
    patternLabelsByKey,
} from '../../utils/overlayItems';

const BAR_TIMES = new Set([1, 2, 3, 4, 5]);
const LAST_BAR_TIME = 5;

function pattern(over: Partial<ChartOverlay> = {}): ChartOverlay {
    return {
        id: 'pattern:double_bottom:1',
        kind: 'pattern',
        skill: 'double_bottom',
        sourceRef: 'p1',
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
        levels: [],
        labels: [],
        ...over,
    };
}

function trendline(
    id: string,
    from: number,
    to: number,
    over: Partial<ChartOverlay> = {}
): ChartOverlay {
    return {
        id,
        kind: 'trendline',
        skill: 'trendline',
        sourceRef: 'trendlines',
        variant: 'primary',
        segments: [
            {
                from: { time: 1, price: from },
                to: { time: 3, price: to },
                role: from < to ? 'resistance' : 'support',
                style: 'solid',
                pane: 'price',
            },
        ],
        levels: [],
        labels: [],
        ...over,
    };
}

const noLabel = (): undefined => undefined;

describe('buildOverlayMenuItems', () => {
    it('key rule: pattern/divergence/fibonacci/elliott use sourceRef; trendline uses overlay.id', () => {
        const items = buildOverlayMenuItems(
            [pattern(), trendline('trendline:1', 10, 12)],
            {
                barTimes: BAR_TIMES,
                lastBarTime: LAST_BAR_TIME,
                labelFor: noLabel,
                hasActionPrices: false,
            }
        );
        const patternItem = items.find(i => i.kind === 'pattern');
        const trendItem = items.find(i => i.kind === 'trendline');
        expect(patternItem?.key).toBe('p1');
        expect(trendItem?.key).toBe('trendline:1');
    });

    it('numbers trendlines from 1 per direction, based on segment slope', () => {
        const items = buildOverlayMenuItems(
            [
                trendline('up-a', 10, 12), // up #1
                trendline('down-a', 12, 10), // down #1
                trendline('up-b', 5, 8), // up #2
            ],
            {
                barTimes: BAR_TIMES,
                lastBarTime: LAST_BAR_TIME,
                labelFor: noLabel,
                hasActionPrices: false,
            }
        );
        const byKey = new Map(items.map(i => [i.key, i]));
        const upA = byKey.get('up-a');
        const upB = byKey.get('up-b');
        const downA = byKey.get('down-a');
        expect(upA?.kind).toBe('trendline');
        if (upA?.kind === 'trendline') {
            expect(upA.direction).toBe('up');
            expect(upA.index).toBe(1);
        }
        if (upB?.kind === 'trendline') {
            expect(upB.direction).toBe('up');
            expect(upB.index).toBe(2);
        }
        if (downA?.kind === 'trendline') {
            expect(downA.direction).toBe('down');
            expect(downA.index).toBe(1);
        }
    });

    it('elliott primary + alternate wave sharing a sourceRef collapse into one item', () => {
        const primary = pattern({
            id: 'elliott:wave:1',
            kind: 'elliott',
            sourceRef: 'e1',
            variant: 'primary',
        });
        const alternate = pattern({
            id: 'elliott:wave:2',
            kind: 'elliott',
            sourceRef: 'e1',
            variant: 'alternate',
        });
        const items = buildOverlayMenuItems([primary, alternate], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: noLabel,
            hasActionPrices: false,
        });
        expect(items.filter(i => i.kind === 'elliott')).toHaveLength(1);
        expect(items.find(i => i.kind === 'elliott')?.key).toBe('e1');
    });

    it('excludes overlays that are not drawn (misaligned to the loaded bars)', () => {
        const misaligned = pattern({
            sourceRef: 'misaligned',
            levels: [{ price: 1, fromTime: 99, label: '' }],
        });
        const items = buildOverlayMenuItems([pattern(), misaligned], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: noLabel,
            hasActionPrices: false,
        });
        expect(items.some(i => i.key === 'misaligned')).toBe(false);
        expect(items.some(i => i.key === 'p1')).toBe(true);
    });

    it('places the action-prices item first, only when hasActionPrices is true', () => {
        const withAction = buildOverlayMenuItems([pattern()], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: noLabel,
            hasActionPrices: true,
        });
        expect(withAction[0]?.key).toBe(ACTION_PRICES_ITEM_KEY);
        expect(withAction[0]?.kind).toBe('action');

        const withoutAction = buildOverlayMenuItems([pattern()], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: noLabel,
            hasActionPrices: false,
        });
        expect(withoutAction.some(i => i.kind === 'action')).toBe(false);
    });

    it('labelFor supplies the card label; falls back to sourceRef when it returns undefined', () => {
        const items = buildOverlayMenuItems([pattern()], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: ref => (ref === 'p1' ? '더블 바텀' : undefined),
            hasActionPrices: false,
        });
        const item = items.find(i => i.key === 'p1');
        expect(item?.kind === 'pattern' && item.label).toBe('더블 바텀');

        const fallback = buildOverlayMenuItems([pattern()], {
            barTimes: BAR_TIMES,
            lastBarTime: LAST_BAR_TIME,
            labelFor: noLabel,
            hasActionPrices: false,
        });
        const fallbackItem = fallback.find(i => i.key === 'p1');
        expect(fallbackItem?.kind === 'pattern' && fallbackItem.label).toBe(
            'p1'
        );
    });
});

describe('patternLabelsByKey', () => {
    it('패턴 항목만 key → 라벨로 담는다', () => {
        const map = patternLabelsByKey([
            { key: 'rounding_bottom_0', kind: 'pattern', label: '원형 바닥' },
            { key: 'fib_0', kind: 'fibonacci', label: '피보나치 전략' },
            { key: 'tl:1', kind: 'trendline', direction: 'up', index: 1 },
        ]);
        expect([...map]).toEqual([['rounding_bottom_0', '원형 바닥']]);
    });
});
