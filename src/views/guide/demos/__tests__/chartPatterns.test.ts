import { describe, expect, it } from 'vitest';
import { getGuideDemo } from '@/views/guide/demos/registry';
import type { DemoOverlay } from '@/views/guide/demos/types';

interface Segment {
    from: number;
    to: number;
    at: (i: number) => number;
}

const CONVERGING = [
    'ascending-triangle',
    'descending-triangle',
    'symmetrical-triangle',
    'ascending-wedge',
    'descending-wedge',
    'pennant',
];

function segments(overlays: readonly DemoOverlay[], last: number): Segment[] {
    return overlays.flatMap((overlay): Segment[] => {
        if (overlay.kind === 'level')
            return [
                {
                    from: overlay.fromIndex ?? 0,
                    to: last,
                    at: () => overlay.price,
                },
            ];
        if (overlay.kind === 'line' && overlay.role !== 'neutral') {
            const { from, to } = overlay;
            const slope = (to.price - from.price) / (to.i - from.i);
            return [
                {
                    from: from.i,
                    to: to.i,
                    at: i => from.price + slope * (i - from.i),
                },
            ];
        }
        return [];
    });
}

/** 두 선이 만나는 x (평행이면 null). 선분 정의에서 기울기를 다시 구한다. */
function apexOf(a: Segment, b: Segment): number | null {
    const slopeA = a.at(1) - a.at(0);
    const slopeB = b.at(1) - b.at(0);
    if (slopeA === slopeB) return null;
    return (b.at(0) - a.at(0)) / (slopeA - slopeB);
}

describe('converging chart pattern demos', () => {
    it.each(CONVERGING)(
        '%s keeps its two lines uncrossed and breaks out before the apex',
        slug => {
            const demo = getGuideDemo('chart-patterns', slug);
            if (demo === null) throw new Error(slug);
            const last = demo.bars.length - 1;
            const lines = segments(demo.overlays ?? [], last);
            expect(lines).toHaveLength(2);
            const [a, b] = lines;
            const start = Math.max(a.from, b.from);
            const end = Math.min(a.to, b.to);
            const signs = Array.from({ length: end - start + 1 }, (_, k) =>
                Math.sign(a.at(start + k) - b.at(start + k))
            );
            expect(new Set(signs.filter(sign => sign !== 0)).size).toBe(1);
            expect(signs).not.toContain(0);

            const apex = apexOf(a, b);
            const breakout = (demo.overlays ?? []).find(
                overlay =>
                    overlay.kind === 'marker' &&
                    (overlay.label === 'Breakout' ||
                        overlay.label === 'Breakdown')
            );
            if (breakout?.kind !== 'marker') throw new Error('no breakout');
            if (apex !== null && apex > start)
                expect(breakout.i).toBeLessThan(apex);
        }
    );
});
