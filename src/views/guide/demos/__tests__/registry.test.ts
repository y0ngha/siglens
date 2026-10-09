import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGuideDemo } from '@/views/guide/demos/registry';
import type { GuideDemo } from '@/views/guide/demos/types';

const SEED_ROOT = path.resolve(__dirname, '../../../../../db/seeds/guide');
const CATEGORIES = [
    'candlesticks',
    'chart-patterns',
    'indicators',
    'strategies',
] as const;

const SLUGS = CATEGORIES.flatMap(category =>
    readdirSync(path.join(SEED_ROOT, category), { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => ({ category, slug: entry.name }))
);

const isFinitePrice = (value: number) => Number.isFinite(value) && value > 0;

function demoValues(demo: GuideDemo): (readonly (number | null)[])[] {
    const lists: (readonly (number | null)[])[] = [];
    for (const overlay of demo.overlays ?? []) {
        if (overlay.kind === 'series') lists.push(overlay.values);
        if (overlay.kind === 'band') lists.push(overlay.upper, overlay.lower);
    }
    for (const pane of demo.panes ?? []) {
        for (const line of pane.lines ?? []) lists.push(line.values);
        if (pane.histogram !== undefined) lists.push(pane.histogram);
    }
    return lists;
}

describe('getGuideDemo registry', () => {
    it('covers all 90 seeded guide entries', () => {
        expect(SLUGS).toHaveLength(90);
        for (const { category, slug } of SLUGS) {
            expect(
                getGuideDemo(category, slug),
                `${category}/${slug}`
            ).not.toBeNull();
        }
    });

    it('returns null for unknown category or slug', () => {
        expect(getGuideDemo('nope', 'rsi')).toBeNull();
        expect(getGuideDemo('indicators', 'nope')).toBeNull();
        expect(getGuideDemo('indicators', 'constructor')).toBeNull();
        expect(getGuideDemo('candlesticks', 'rsi')).toBeNull();
    });

    it('is deterministic', () => {
        for (const { category, slug } of SLUGS) {
            expect(JSON.stringify(getGuideDemo(category, slug))).toBe(
                JSON.stringify(getGuideDemo(category, slug))
            );
        }
    });

    it('every demo has valid bars and in-range overlay indexes', () => {
        for (const { category, slug } of SLUGS) {
            const demo = getGuideDemo(category, slug) as GuideDemo;
            const n = demo.bars.length;
            const where = `${category}/${slug}`;
            expect(n, where).toBeGreaterThanOrEqual(3);
            demo.bars.forEach((bar, i) => {
                for (const v of [bar.open, bar.high, bar.low, bar.close]) {
                    expect(isFinitePrice(v), `${where}#${i}`).toBe(true);
                }
                expect(bar.high, `${where}#${i}`).toBeGreaterThanOrEqual(
                    Math.max(bar.open, bar.close) - 1e-9
                );
                expect(bar.low, `${where}#${i}`).toBeLessThanOrEqual(
                    Math.min(bar.open, bar.close) + 1e-9
                );
                if (i > 0)
                    expect(bar.time, where).toBeGreaterThan(
                        demo.bars[i - 1].time
                    );
            });
            for (const overlay of demo.overlays ?? []) {
                if (overlay.kind === 'marker') {
                    expect(
                        overlay.i,
                        `${where} marker ${overlay.label}`
                    ).toBeGreaterThanOrEqual(0);
                    expect(
                        overlay.i,
                        `${where} marker ${overlay.label}`
                    ).toBeLessThan(n);
                }
                if (overlay.kind === 'line') {
                    for (const end of [overlay.from, overlay.to]) {
                        expect(Number.isFinite(end.price), where).toBe(true);
                        expect(end.i, where).toBeGreaterThanOrEqual(-1);
                        expect(end.i, where).toBeLessThanOrEqual(n);
                    }
                }
                if (overlay.kind === 'zone') {
                    expect(overlay.fromIndex, where).toBeGreaterThanOrEqual(0);
                    expect(overlay.toIndex, where).toBeLessThan(n);
                }
            }
            if (demo.highlight !== undefined) {
                expect(demo.highlight.toIndex, where).toBeLessThan(n);
            }
        }
    });

    it('chart-pattern demos end with a breakout/breakdown marker where the article describes one', () => {
        const withBreak = SLUGS.filter(
            ({ category, slug }) =>
                category === 'chart-patterns' && slug !== 'broadening-formation'
        );
        for (const { category, slug } of withBreak) {
            const demo = getGuideDemo(category, slug) as GuideDemo;
            const hasBreak = (demo.overlays ?? []).some(
                overlay =>
                    overlay.kind === 'marker' &&
                    (overlay.label === 'Breakout' ||
                        overlay.label === 'Breakdown')
            );
            expect(hasBreak, slug).toBe(true);
        }
    });
});

describe('indicator and strategy demos use real computed series', () => {
    it('every indicator and strategy series is non-empty and finite', () => {
        const targets = SLUGS.filter(
            ({ category }) =>
                category === 'indicators' || category === 'strategies'
        );
        for (const { category, slug } of targets) {
            const demo = getGuideDemo(category, slug) as GuideDemo;
            const lists = demoValues(demo);
            const plotted = (demo.overlays ?? []).some(
                o =>
                    o.kind === 'profile' ||
                    o.kind === 'zone' ||
                    o.kind === 'level' ||
                    o.kind === 'line'
            );
            expect(
                lists.length > 0 ||
                    plotted ||
                    demo.bars.some(b => b.tone !== undefined),
                `${category}/${slug} has something to plot`
            ).toBe(true);
            for (const values of lists) {
                const finite = values.filter(v => v !== null);
                expect(
                    finite.length,
                    `${category}/${slug} series`
                ).toBeGreaterThan(0);
                for (const v of finite)
                    expect(Number.isFinite(v), `${category}/${slug}`).toBe(
                        true
                    );
                expect(
                    values.length,
                    `${category}/${slug} aligned with bars`
                ).toBeLessThanOrEqual(demo.bars.length);
            }
        }
    });

    it('shared series is at least 220 bars', async () => {
        const { getSharedSeries } =
            await import('@/views/guide/demos/sharedSeries');
        expect(getSharedSeries().bars.length).toBeGreaterThanOrEqual(220);
    });

    it('divergence demos really diverge (price lower low, indicator higher low)', async () => {
        const {
            getDivergenceSeries,
            DIVERGENCE_LOW_1: a,
            DIVERGENCE_LOW_2: b,
        } = await import('@/views/guide/demos/sharedSeries');
        const { bars, result } = getDivergenceSeries();
        expect(bars[b].low).toBeLessThan(bars[a].low);
        for (const series of [result.rsi, result.obv, result.forceIndex]) {
            expect(series[b] as number).toBeGreaterThan(series[a] as number);
        }
    });

    it('pivot levels follow the standard formula from the prior session', () => {
        const demo = getGuideDemo('strategies', 'pivot-points') as GuideDemo;
        const prior = demo.bars.slice(0, 15);
        const high = Math.max(...prior.map(b => b.high));
        const low = Math.min(...prior.map(b => b.low));
        const pivot = (high + low + prior[14].close) / 3;
        const levels = Object.fromEntries(
            (demo.overlays ?? []).flatMap(o =>
                o.kind === 'level' ? [[o.label, o.price]] : []
            )
        );
        expect(levels.P).toBeCloseTo(pivot, 6);
        expect(levels.R1).toBeCloseTo(2 * pivot - low, 6);
        expect(levels.S1).toBeCloseTo(2 * pivot - high, 6);
    });
});
