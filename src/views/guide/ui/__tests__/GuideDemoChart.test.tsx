import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getGuideDemo } from '@/views/guide/demos/registry';
import type { DemoBar, GuideDemo } from '@/views/guide/demos/types';
import { estimateLabelWidth } from '@/views/guide/lib/chartLayout';
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

    describe('price domain and label placement', () => {
        const flatBars = (count: number): DemoBar[] =>
            Array.from({ length: count }, (_, i) => ({
                time: i,
                open: 102,
                high: 110,
                low: 100,
                close: 108,
            }));
        const renderDemo = (demo: GuideDemo) =>
            render(<GuideDemoChart caption="c" demo={demo} title="t" />)
                .container;
        const axisValues = (container: HTMLElement): number[] =>
            Array.from(container.querySelectorAll('text.fill-secondary-400'))
                .map(node => Number(node.textContent))
                .filter(Number.isFinite);
        const labelTexts = (container: HTMLElement): string[] =>
            Array.from(container.querySelectorAll('text')).map(
                node => node.textContent ?? ''
            );
        const farSeries = (includeInDomain: boolean): GuideDemo => ({
            bars: flatBars(6),
            overlays: [
                {
                    kind: 'series',
                    values: Array(6).fill(200),
                    label: 'FAR',
                    includeInDomain,
                },
            ],
        });

        it('does not stretch the price axis for a series far from the bars, and skips its label', () => {
            const container = renderDemo(farSeries(false));
            const values = axisValues(container);
            expect(values.length).toBeGreaterThan(0);
            expect(Math.max(...values)).toBeLessThan(120);
            expect(labelTexts(container)).not.toContain('FAR');
        });

        it('stretches the price axis and labels the series with includeInDomain', () => {
            const container = renderDemo(farSeries(true));
            expect(Math.max(...axisValues(container))).toBeGreaterThanOrEqual(
                180
            );
            expect(labelTexts(container)).toContain('FAR');
        });

        it('keeps a marker label off every candle body', () => {
            const bars: DemoBar[] = Array.from({ length: 30 }, (_, i) => ({
                time: i,
                open: 100 + i * 12,
                high: 108 + i * 12,
                low: 99 + i * 12,
                close: 106 + i * 12,
            }));
            const container = renderDemo({
                bars,
                overlays: [
                    {
                        kind: 'marker',
                        i: 10,
                        position: 'above',
                        label: 'BREAKOUT',
                        tone: 'bull',
                    },
                ],
            });
            const text = Array.from(container.querySelectorAll('text')).find(
                node => node.textContent === 'BREAKOUT'
            );
            expect(text).toBeDefined();
            const width = estimateLabelWidth('BREAKOUT', 12);
            const cx = Number(text?.getAttribute('x'));
            const cy = Number(text?.getAttribute('y'));
            const label = {
                left: cx - width / 2,
                right: cx + width / 2,
                top: cy - 6,
                bottom: cy + 6,
            };
            const bodies = Array.from(
                container.querySelectorAll('rect[class*="fill-chart-"]')
            );
            expect(bodies).toHaveLength(30);
            for (const body of bodies) {
                const x = Number(body.getAttribute('x'));
                const y = Number(body.getAttribute('y'));
                const w = Number(body.getAttribute('width'));
                const h = Number(body.getAttribute('height'));
                const hit =
                    label.left < x + w &&
                    x < label.right &&
                    label.top < y + h &&
                    y < label.bottom;
                expect(hit).toBe(false);
            }
        });
    });
});
