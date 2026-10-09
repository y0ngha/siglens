import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getGuideDemo } from '@/views/guide/demos/registry';
import type { GuideDemo } from '@/views/guide/demos/types';
import { GuideDemoChart } from '@/views/guide/ui/GuideDemoChart';

function demoOf(category: string, slug: string): GuideDemo {
    const demo = getGuideDemo(category, slug);
    if (demo === null) throw new Error(`${category}/${slug}`);
    return demo;
}

describe('GuideDemoChart', () => {
    it('renders an accessible figure with title, description and caption', () => {
        const { container } = render(
            <GuideDemoChart
                caption="설명용 캡션"
                demo={demoOf('candlesticks', 'hammer-shooting-star')}
                title="망치형"
            />
        );
        const svg = container.querySelector('svg');
        expect(svg?.getAttribute('role')).toBe('img');
        const labelledBy =
            svg?.getAttribute('aria-labelledby')?.split(' ') ?? [];
        expect(labelledBy).toHaveLength(2);
        expect(
            container.querySelector(`[id="${labelledBy[0]}"]`)?.textContent
        ).toBe('망치형');
        expect(
            container.querySelector(`[id="${labelledBy[1]}"]`)?.textContent
        ).toBe('설명용 캡션');
        expect(container.querySelector('figcaption')?.textContent).toBe(
            '설명용 캡션'
        );
    });

    it('omits the figcaption and falls back to a generated description without a caption', () => {
        const { container } = render(
            <GuideDemoChart
                caption={null}
                demo={demoOf('indicators', 'macd')}
                title="MACD"
            />
        );
        expect(container.querySelector('figcaption')).toBeNull();
        expect(container.querySelector('desc')?.textContent).toContain(
            'candlesticks'
        );
    });

    it('draws one candle body per bar plus pane content, with token colours only', () => {
        const demo = demoOf('indicators', 'macd');
        const { container } = render(
            <GuideDemoChart caption={null} demo={demo} title="MACD" />
        );
        const html = container.innerHTML;
        expect(
            container.querySelectorAll('clipPath + g, g[clip-path] > g').length
        ).toBeGreaterThanOrEqual(demo.bars.length);
        expect(html).toContain('fill-chart-bullish');
        expect(html).toContain('fill-chart-bearish');
        expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
        expect(html).not.toMatch(/(?:fill|stroke)="#/);
    });

    it('renders every registered demo without throwing', () => {
        for (const [category, slug] of [
            ['candlesticks', 'candle-basics'],
            ['chart-patterns', 'cup-and-handle'],
            ['indicators', 'volume-profile'],
            ['indicators', 'ichimoku-cloud'],
            ['indicators', 'parabolic-sar'],
            ['indicators', 'elder-impulse'],
            ['strategies', 'breakout'],
        ] as const) {
            const { container, unmount } = render(
                <GuideDemoChart
                    caption="c"
                    demo={demoOf(category, slug)}
                    title={slug}
                />
            );
            expect(container.querySelectorAll('rect').length).toBeGreaterThan(
                0
            );
            unmount();
        }
    });
});
