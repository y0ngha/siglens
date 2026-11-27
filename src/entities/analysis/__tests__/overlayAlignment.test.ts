import type { ChartOverlay } from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import {
    barTimesOf,
    isOverlayAlignedToBars,
    overlayTimes,
} from '@/entities/analysis/lib/overlayAlignment';

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

describe('barTimesOf', () => {
    it('collects each bar time into a Set', () => {
        const bars = [{ time: 1 }, { time: 2 }, { time: 3 }];
        expect(barTimesOf(bars)).toEqual(new Set([1, 2, 3]));
    });
});

describe('overlayTimes', () => {
    it('lists every segment endpoint, level start and label time', () => {
        expect(
            overlayTimes(
                overlay({
                    labels: [
                        { at: { time: 4, price: 1 }, text: 'x' },
                    ] as ChartOverlay['labels'],
                })
            )
        ).toEqual([1, 3, 1, 4]);
    });
});

describe('isOverlayAlignedToBars', () => {
    it('true when every anchor time is a loaded bar', () => {
        expect(isOverlayAlignedToBars(overlay({}), BAR_TIMES)).toBe(true);
    });

    it('false when any anchor time is missing from the bars', () => {
        expect(
            isOverlayAlignedToBars(
                overlay({ levels: [{ price: 1, fromTime: 99, label: '' }] }),
                BAR_TIMES
            )
        ).toBe(false);
    });
});
