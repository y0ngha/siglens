import { describe, expect, it } from 'vitest';
import { INDICATOR_DEMOS } from '@/views/guide/demos/indicators';
import { getSharedSeries } from '@/views/guide/demos/sharedSeries';
import type {
    DemoOverlay,
    DemoPane,
    GuideDemo,
} from '@/views/guide/demos/types';

type Num = number | null;
type Marker = Extract<DemoOverlay, { kind: 'marker' }>;
type Zone = Extract<DemoOverlay, { kind: 'zone' }>;
type Series = Extract<DemoOverlay, { kind: 'series' }>;
type Band = Extract<DemoOverlay, { kind: 'band' }>;

const demo = (slug: string): GuideDemo => INDICATOR_DEMOS[slug]();

const markers = (d: GuideDemo): Marker[] =>
    (d.overlays ?? []).filter((o): o is Marker => o.kind === 'marker');
const zones = (d: GuideDemo): Zone[] =>
    (d.overlays ?? []).filter((o): o is Zone => o.kind === 'zone');
const series = (d: GuideDemo): Series[] =>
    (d.overlays ?? []).filter((o): o is Series => o.kind === 'series');
const firstMarker = (d: GuideDemo, label?: string): Marker => {
    const found = markers(d).find(
        m => label === undefined || m.label === label
    );
    if (found === undefined) throw new Error(`marker ${label ?? ''} missing`);
    return found;
};
const pane = (d: GuideDemo, index = 0): DemoPane => {
    const found = d.panes?.[index];
    if (found === undefined) throw new Error(`pane ${index} missing`);
    return found;
};
const line = (d: GuideDemo, index = 0, paneIndex = 0): readonly Num[] =>
    pane(d, paneIndex).lines?.[index].values ?? [];
const defined = (values: readonly Num[], from = 0, to = values.length) =>
    values.slice(from, to).filter((v): v is number => v !== null);
const crossed = (values: readonly Num[], level: number) =>
    values.some(
        (v, i) =>
            i > 0 &&
            v !== null &&
            values[i - 1] !== null &&
            (values[i - 1]! - level) * (v - level) < 0
    );

describe('vwap demo', () => {
    const d = demo('vwap');
    const vwap = series(d)[0].values;

    it('is one intraday UTC session so VWAP accumulates', () => {
        const days = new Set(d.bars.map(b => Math.floor(b.time / 86_400)));
        expect(days.size).toBe(1);
        expect(d.bars[1].time - d.bars[0].time).toBe(300);
        expect(d.bars.length).toBeGreaterThanOrEqual(70);
    });

    it('does not trace the typical price (daily-bar regression)', () => {
        const apart = d.bars.filter((b, i) => {
            const typical = (b.high + b.low + b.close) / 3;
            return Math.abs(vwap[i]! - typical) / typical > 0.002;
        });
        expect(apart.length).toBeGreaterThan(d.bars.length * 0.6);
    });

    it('marks a volume-backed close crossing above VWAP', () => {
        const m = firstMarker(d, 'Above VWAP');
        expect(d.bars[m.i].close).toBeGreaterThan(vwap[m.i]!);
        expect(d.bars[m.i - 1].close).toBeLessThanOrEqual(vwap[m.i - 1]!);
        const volumes = d.bars.map(b => b.volume ?? 0);
        const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        const near = Math.max(...volumes.slice(m.i - 3, m.i + 1));
        expect(near).toBeGreaterThan(mean * 1.5);
    });
});

describe('bollinger-bands demo', () => {
    const d = demo('bollinger-bands');
    const band = d.overlays?.find((o): o is Band => o.kind === 'band');

    it('narrows to a squeeze inside the window and then expands', () => {
        // 밴드폭은 가격 대비 비율(볼린저 밴드폭)로 잰다 — 가격이 오르면 같은 비율도 절대폭은 커진다.
        const middle = series(d)[0].values;
        const width = band!.upper.map((u, i) =>
            u === null || band!.lower[i] === null
                ? null
                : (u - band!.lower[i]!) / middle[i]!
        );
        const valid = width.flatMap((w, i) => (w === null ? [] : [{ w, i }]));
        const squeeze = valid.reduce((a, b) => (b.w < a.w ? b : a));
        // 왼쪽 끝에 잘려 있지 않고, 뒤에 충분한 확장이 따라온다.
        expect(squeeze.i).toBeGreaterThan(valid[0].i + 20);
        expect(squeeze.i).toBeLessThan(width.length - 15);
        const after = Math.max(...defined(width, squeeze.i));
        expect(after).toBeGreaterThan(squeeze.w * 2);
        const before = Math.max(...defined(width, valid[0].i, squeeze.i));
        expect(before).toBeGreaterThan(squeeze.w * 2);
    });

    it('lets price ride the upper band after the squeeze', () => {
        const upper = band!.upper;
        const above = d.bars.filter(
            (b, i) => upper[i] !== null && b.close > upper[i]!
        );
        expect(above.length).toBeGreaterThanOrEqual(3);
    });
});

describe('hurst and variance-ratio demos', () => {
    it('hurst crosses the 0.5 line from trending to mean-reverting', () => {
        const d = demo('hurst');
        const h = line(d);
        const [trend, mr] = zones(d);
        expect(trend.label).toBe('Trending');
        expect(mr.label).toBe('Mean-reverting');
        expect(Math.max(...defined(h, 0, trend.toIndex + 1))).toBeGreaterThan(
            0.6
        );
        expect(Math.min(...defined(h, mr.fromIndex))).toBeLessThan(0.4);
        expect(defined(h).at(-1)!).toBeLessThan(0.4);
        expect(crossed(h, 0.5)).toBe(true);
    });

    it('variance ratio crosses 1 from >=1.2 to <=0.8', () => {
        const d = demo('variance-ratio');
        const vr = line(d);
        const values = defined(vr);
        expect(Math.max(...values)).toBeGreaterThanOrEqual(1.2);
        expect(Math.min(...values)).toBeLessThanOrEqual(0.8);
        expect(values[0]).toBeGreaterThanOrEqual(1.2);
        expect(values.at(-1)!).toBeLessThanOrEqual(0.8);
        expect(crossed(vr, 1)).toBe(true);
    });

    it('both demos describe the same two-regime series', () => {
        const [a, b] = [demo('hurst'), demo('variance-ratio')];
        expect(zones(a).map(z => z.label)).toEqual(zones(b).map(z => z.label));
    });
});

describe('dmi demo', () => {
    const d = demo('dmi');
    const [plus, minus, adx] = [line(d, 0), line(d, 1), line(d, 2)];
    const m = firstMarker(d);

    it('marks a true +DI up-cross of -DI', () => {
        expect(plus[m.i]!).toBeGreaterThan(minus[m.i]!);
        expect(plus[m.i - 1]!).toBeLessThanOrEqual(minus[m.i - 1]!);
    });

    it('lets ADX turn up and keep rising after the cross', () => {
        const after = defined(adx, m.i);
        const low = Math.min(...after);
        const lowIndex = m.i + after.indexOf(low);
        expect(adx.at(-1)!).toBeGreaterThan(low + 5);
        expect(lowIndex).toBeLessThan(adx.length - 5);
    });
});

describe('squeeze-momentum demo', () => {
    const d = demo('squeeze-momentum');
    const momentum = pane(d).histogram!;
    const m = firstMarker(d, 'Release');

    it('highlights the squeeze right before the release', () => {
        expect(d.highlight).toBeDefined();
        expect(d.highlight!.toIndex).toBe(m.i - 1);
        expect(d.highlight!.toIndex - d.highlight!.fromIndex).toBeGreaterThan(
            8
        );
    });

    it('releases into rising positive momentum and a rising price', () => {
        expect(momentum[m.i]!).toBeGreaterThan(momentum[m.i - 1]!);
        expect(Math.max(...defined(momentum, m.i))).toBeGreaterThan(5);
        expect(d.bars.at(-1)!.close).toBeGreaterThan(d.bars[m.i].close);
    });
});

describe('rsi demo', () => {
    const d = demo('rsi');
    const rsi = line(d);

    it('marks a true upward cross of 70 and the later fall back below', () => {
        const up = firstMarker(d, 'RSI > 70');
        expect(rsi[up.i]!).toBeGreaterThan(70);
        expect(rsi[up.i - 1]!).toBeLessThanOrEqual(70);
        const down = firstMarker(d, 'Back below 70');
        expect(down.i).toBeGreaterThan(up.i);
        expect(rsi[down.i]!).toBeLessThan(70);
        expect(rsi[down.i - 1]!).toBeGreaterThanOrEqual(70);
    });
});

describe('cmf demo', () => {
    const d = demo('cmf');
    const cmf = pane(d).histogram!;

    it('uses the core 21 period in its label', () => {
        expect(pane(d).label).toBe('CMF 21');
    });

    it('marks the first true upward 0-cross', () => {
        const m = firstMarker(d);
        expect(cmf[m.i]!).toBeGreaterThan(0);
        expect(cmf[m.i - 1]!).toBeLessThanOrEqual(0);
        expect(cmf.slice(0, m.i).every(v => (v ?? -1) <= 0)).toBe(true);
        expect(Math.max(...defined(cmf, m.i))).toBeGreaterThan(0.2);
    });
});

describe('bollinger-percent-b demo', () => {
    const d = demo('bollinger-percent-b');
    const pctB = line(d);

    it('marks the drop from >=0.95 to below it, then a slide toward 0', () => {
        const m = firstMarker(d);
        expect(pctB[m.i]!).toBeLessThan(0.95);
        expect(pctB[m.i - 1]!).toBeGreaterThanOrEqual(0.95);
        expect(Math.min(...defined(pctB, m.i))).toBeLessThan(0.1);
    });

    it('labels the 0.95 and 0.05 reference lines', () => {
        const labels = pane(d).levels?.map(l => l.label);
        expect(labels).toContain('0.95');
        expect(labels).toContain('0.05');
    });
});

describe('chandelier-exit and supertrend demos', () => {
    it.each([
        ['chandelier-exit', 'Exit'],
        ['supertrend', 'Flip'],
    ])(
        '%s rises through the uptrend and keeps its flip in view',
        (slug, label) => {
            const d = demo(slug);
            const rising = defined(series(d)[0].values);
            expect(rising.at(-1)!).toBeGreaterThan(rising[0] * 1.1);
            const m = firstMarker(d, label);
            expect(m.i).toBeGreaterThan(rising.length * 0.5);
            expect(m.i).toBeLessThan(d.bars.length - 5);
        }
    );
});

describe('atr demo', () => {
    it('rises with widening ranges and falls as they calm', () => {
        const atr = defined(line(demo('atr')));
        const peak = Math.max(...atr);
        expect(peak).toBeGreaterThan(atr[0] * 2.5);
        expect(atr.at(-1)!).toBeLessThan(peak * 0.5);
        expect(atr.indexOf(peak)).toBeGreaterThan(20);
        expect(atr.indexOf(peak)).toBeLessThan(atr.length - 20);
    });
});

describe('ewma-volatility demo', () => {
    it('jumps after the big drop and then eases', () => {
        const d = demo('ewma-volatility');
        const vol = line(d);
        const m = firstMarker(d, 'Big drop');
        const peak = Math.max(...defined(vol, m.i));
        expect(peak).toBeGreaterThan(vol[m.i - 1]! * 1.1);
        expect(vol.at(-1)!).toBeLessThan(peak * 0.95);
    });
});

describe('buy-sell-volume demo', () => {
    it('draws buy upward and sell downward over about 30 bars', () => {
        const d = demo('buy-sell-volume');
        expect(d.bars).toHaveLength(30);
        expect(defined(pane(d, 0).histogram!).every(v => v >= 0)).toBe(true);
        expect(defined(pane(d, 1).histogram!).every(v => v <= 0)).toBe(true);
    });
});

describe('elder-impulse demo', () => {
    it('overlays the 13-period EMA that core uses', () => {
        const d = demo('elder-impulse');
        const ema13 = series(d)[0];
        expect(ema13.label).toBe('EMA13');
        const closes = getSharedSeries().bars.map(b => b.close);
        const k = 2 / 14;
        const expected = closes.reduce<number[]>((acc, close, i) => {
            if (i < 12) return acc;
            if (i === 12) {
                return [closes.slice(0, 13).reduce((a, b) => a + b, 0) / 13];
            }
            return [...acc, close * k + acc.at(-1)! * (1 - k)];
        }, []);
        // 창은 시세의 20번째 봉부터이고 EMA13은 12번째 봉부터 값이 나온다.
        const windowStart = 20;
        expect(ema13.values.at(-1)!).toBeCloseTo(
            expected[windowStart + ema13.values.length - 1 - 12],
            6
        );
    });
});

describe('ma demo', () => {
    const d = demo('ma');
    const [short, long] = series(d);

    it('shows MA20 and MA50 (the Siglens golden-cross pair)', () => {
        expect([short.label, long.label]).toEqual(['MA20', 'MA50']);
    });

    it('marks a true 20-over-50 upward cross', () => {
        const m = firstMarker(d);
        expect(short.values[m.i]!).toBeGreaterThan(long.values[m.i]!);
        expect(short.values[m.i - 1]!).toBeLessThanOrEqual(
            long.values[m.i - 1]!
        );
    });
});

describe('macd demo', () => {
    it('grows the histogram visibly after the cross', () => {
        const d = demo('macd');
        const hist = pane(d).histogram!;
        const m = firstMarker(d);
        expect(Math.max(...defined(hist, m.i))).toBeGreaterThan(
            hist[m.i]! + 0.7
        );
    });
});

describe('smart-money-concepts demo', () => {
    const d = demo('smart-money-concepts');
    const block = zones(d).find(z => z.label === 'Order block')!;
    const fvg = zones(d).find(z => z.label === 'FVG')!;
    const bos = markers(d).filter(m => m.label === 'BOS' && m.tone === 'bull');

    it('keeps the order-block label apart from the BOS marker', () => {
        expect(markers(d).every(m => m.label !== 'Order block')).toBe(true);
        expect(bos).toHaveLength(1);
        expect(block.toIndex).toBeLessThanOrEqual(bos[0].i);
        expect(block.fromIndex).toBeLessThan(bos[0].i);
    });

    it('draws the FVG wide enough to read, away from the right edge squeeze', () => {
        expect(fvg.toIndex - fvg.fromIndex).toBeGreaterThanOrEqual(5);
        expect(fvg.fromIndex).toBeGreaterThan(bos[0].i - 1);
    });
});

describe('volume-profile demo', () => {
    it('ends below the value area so bars do not cover the last candles', () => {
        const d = demo('volume-profile');
        const val = d.overlays?.find(
            o => o.kind === 'level' && o.label === 'VAL'
        );
        expect(val?.kind === 'level' && d.bars.at(-1)!.close < val.price).toBe(
            true
        );
    });
});
