import { renderHook } from '@testing-library/react';
import type { Bar, ChartOverlay } from '@y0ngha/siglens-core';
import { useChartOverlaySpecs } from '../../hooks/useChartOverlaySpecs';

const BARS = [1, 2, 3, 4, 5].map((time): Bar => ({
    time,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1,
}));

const seg = (from: number, to: number): ChartOverlay['segments'][number] => ({
    from: { time: from, price: 100 },
    to: { time: to, price: 101 },
    role: 'pattern',
    style: 'solid',
    pane: 'price',
});

const overlay = (sourceRef: string): ChartOverlay => ({
    id: `pattern:${sourceRef}`,
    kind: 'pattern',
    skill: 'double_top',
    sourceRef,
    variant: 'primary',
    segments: [seg(1, 3)],
    levels: [
        { price: 130, fromTime: 1, label: 'target' },
        { price: 90, fromTime: 1, label: 'invalidation' },
    ],
    labels: [],
});

function specsFor(referenceOnlyKeys: ReadonlySet<string>) {
    const { result } = renderHook(() =>
        useChartOverlaySpecs({
            chartOverlays: [overlay('a'), overlay('b')],
            overlayColors: {},
            overlayItems: [
                { key: 'a', kind: 'pattern', label: '이중천장' },
                { key: 'b', kind: 'pattern', label: '이중바닥' },
            ],
            hiddenOverlayKeys: new Set(),
            highlightedOverlayKey: null,
            bars: BARS,
            rsiPaneIndex: null,
            extendLevelsRight: false,
            referenceOnlyKeys,
        })
    );
    return result.current.specs;
}

const levelOf = (
    specs: ReturnType<typeof specsFor>,
    title: string
): ReturnType<typeof specsFor>[number] | undefined =>
    specs.find(spec => spec.title === title);

describe('useChartOverlaySpecs reference-only targets', () => {
    it('draws only the target of a reference-only card faded and as a reference distance', () => {
        const specs = specsFor(new Set(['a']));
        expect(levelOf(specs, '이중천장 참고 거리')?.opacity).toBe(0.5);
        expect(levelOf(specs, '이중천장 목표')).toBeUndefined();
        // The other card still draws a normal target, and invalidation lines are untouched.
        expect(levelOf(specs, '이중바닥 목표')?.opacity).toBe(1);
        expect(levelOf(specs, '이중천장 무효화')?.opacity).toBe(1);
    });

    it('draws every target as a plain target when no card is reference-only', () => {
        const specs = specsFor(new Set());
        expect(levelOf(specs, '이중천장 목표')?.opacity).toBe(1);
        expect(levelOf(specs, '이중바닥 목표')?.opacity).toBe(1);
        expect(specs.some(spec => spec.title.includes('참고 거리'))).toBe(
            false
        );
    });
});
