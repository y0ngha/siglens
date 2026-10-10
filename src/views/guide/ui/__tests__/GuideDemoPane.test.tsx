import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DemoPane } from '@/views/guide/demos/types';
import { GuideDemoPane, type PaneFrame } from '@/views/guide/ui/GuideDemoPane';

const BARS = 5;
const frame: PaneFrame = {
    top: 0,
    height: 78,
    left: 6,
    right: 394,
    xOf: index => 6 + (index + 0.5) * 50,
    pitch: 50,
    barCount: BARS,
};

function textsOf(pane: DemoPane): string[] {
    const { container } = render(
        <svg>
            <GuideDemoPane frame={frame} labelFontSize={12} pane={pane} />
        </svg>
    );
    return Array.from(container.querySelectorAll('text')).map(
        node => node.textContent ?? ''
    );
}

describe('GuideDemoPane labels', () => {
    it('compacts large level and axis values instead of printing raw digits', () => {
        const texts = textsOf({
            label: 'VOL',
            histogram: [1_000_000, 2_000_000, 1_500_000, 900_000, 1_200_000],
            levels: [{ value: 12345 }],
        });
        expect(texts).toContain('12K');
        expect(texts.some(text => text.endsWith('M'))).toBe(true);
        expect(texts.some(text => /\d{5,}/.test(text))).toBe(false);
    });

    it('labels a level with its own value when the range yields a single tick', () => {
        const texts = textsOf({
            label: 'X',
            range: [1.1, 1.9],
            levels: [{ value: 1.5 }],
        });
        expect(texts).toContain('1.5');
        expect(texts).not.toContain('2');
    });

    it('keeps a level fractional digits even when the single tick step is whole', () => {
        const texts = textsOf({
            label: 'X',
            range: [10.5, 19.5],
            levels: [{ value: 12.5 }],
        });
        expect(texts).toContain('12.5');
        expect(texts).not.toContain('13');
    });
});
