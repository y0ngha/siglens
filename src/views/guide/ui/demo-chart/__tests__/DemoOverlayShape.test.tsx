import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DemoBar, DemoOverlay } from '@/views/guide/demos/types';
import { demoChartFrame } from '@/views/guide/lib/demoChartLayout';
import { DemoOverlayShape } from '@/views/guide/ui/demo-chart/DemoOverlayShape';

const bars: DemoBar[] = Array.from({ length: 6 }, (_, i) => ({
    time: i,
    open: 102,
    high: 110,
    low: 100,
    close: 108,
}));

function renderShape(overlay: DemoOverlay): SVGSVGElement {
    const frame = demoChartFrame({ bars });
    const { container } = render(
        <svg>
            <DemoOverlayShape bars={bars} frame={frame} overlay={overlay} />
        </svg>
    );
    const svg = container.querySelector('svg');
    if (svg === null) throw new Error('svg not rendered');
    return svg;
}

describe('DemoOverlayShape', () => {
    it('renders nothing, not even a group, for a band with fewer than two valid slots', () => {
        const svg = renderShape({
            kind: 'band',
            upper: [108, null, null, 109, 110, 111],
            lower: [101, 101, 102, null, null, null],
            label: 'BB',
        });
        expect(svg.childElementCount).toBe(0);
    });

    it('renders nothing, not even a group, for a marker on a missing bar', () => {
        const svg = renderShape({
            kind: 'marker',
            i: bars.length,
            position: 'above',
            label: 'B',
            tone: 'bull',
        });
        expect(svg.childElementCount).toBe(0);
    });

    it('wraps a drawable marker in a single group', () => {
        const svg = renderShape({
            kind: 'marker',
            i: 2,
            position: 'below',
            label: 'B',
            tone: 'bull',
        });
        expect(svg.children).toHaveLength(1);
        expect(svg.children[0].tagName).toBe('g');
        expect(svg.querySelectorAll('polygon')).toHaveLength(1);
    });

    it('draws one polyline per unbroken run of a series', () => {
        const svg = renderShape({
            kind: 'series',
            values: [104, 105, null, 106, 107, 108],
            label: 'MA',
        });
        const points = Array.from(svg.querySelectorAll('polyline')).map(line =>
            line.getAttribute('points')
        );
        expect(points).toHaveLength(2);
        expect(new Set(points).size).toBe(2);
    });
});
